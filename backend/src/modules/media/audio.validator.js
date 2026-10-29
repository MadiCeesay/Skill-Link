import { ApiError } from '../../utils/ApiError.js';
// Inspect EBML track metadata, never arbitrary compressed packet bytes. Opus
// packets may legitimately contain strings such as "V_" by coincidence.
function opusWebm(buffer) {
  function element(offset, end) {
    function vint(at, keepMarker) {
      const first = buffer[at];
      if (!first) throw Error();
      let width = 1, mask = 128;
      while (!(first & mask) && width <= 8) { width++; mask >>= 1; }
      if (width > 8 || at + width > end || (keepMarker && width > 4)) throw Error();
      let value = BigInt(keepMarker ? first : first & (mask - 1));
      for (let n = 1; n < width; n++) value = (value << 8n) | BigInt(buffer[at + n]);
      return { width, value, unknown: !keepMarker && value === (1n << BigInt(7 * width)) - 1n };
    }
    const id = vint(offset, true), size = vint(offset + id.width, false);
    const start = offset + id.width + size.width;
    if (!size.unknown && size.value > BigInt(end - start)) throw Error();
    return { id: Number(id.value), start, end: size.unknown ? end : start + Number(size.value), unknown: size.unknown };
  }
  function children(start, end) {
    const result = [];
    while (start < end) {
      const e = element(start, end);
      result.push(e); start = e.end;
    }
    return result;
  }
  try {
    const header = element(0, buffer.length);
    if (header.id !== 0x1a45dfa3 || header.unknown) return false;
    const doc = children(header.start, header.end).find(e => e.id === 0x4282);
    if (!doc || buffer.subarray(doc.start, doc.end).toString() !== 'webm') return false;
    const segment = element(header.end, buffer.length);
    if (segment.id !== 0x18538067 || segment.end !== buffer.length) return false;
    const parts = children(segment.start, segment.end);
    const tracks = parts.filter(e => e.id === 0x1654ae6b);
    if (tracks.length !== 1 || tracks[0].unknown) return false;
    const entries = children(tracks[0].start, tracks[0].end).filter(e => e.id === 0xae);
    if (entries.length !== 1 || entries[0].unknown) return false;
    const fields = children(entries[0].start, entries[0].end);
    const type = fields.filter(e => e.id === 0x83), codec = fields.filter(e => e.id === 0x86);
    return type.length === 1 && type[0].end - type[0].start === 1 && buffer[type[0].start] === 2 &&
      codec.length === 1 && buffer.subarray(codec[0].start, codec[0].end).toString() === 'A_OPUS' &&
      parts.some(e => e.id === 0x1f43b675 && e.end > e.start);
  } catch { return false; }
}
export function audioFormat(buffer, mime) {
  if (
    mime === 'audio/ogg' &&
    buffer.length >= 47 &&
    buffer.subarray(0, 4).toString() === 'OggS' &&
    buffer.includes(Buffer.from('OpusHead')) &&
    !buffer.includes(Buffer.from('theora'))
  )
    return 'ogg';
  if (
    mime === 'audio/webm' &&
    buffer.length >= 32 &&
    buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) &&
    opusWebm(buffer)
  )
    return 'webm';
  if (
    mime === 'audio/wav' &&
    buffer.length >= 44 &&
    buffer.subarray(0, 4).toString() === 'RIFF' &&
    buffer.subarray(8, 12).toString() === 'WAVE' &&
    buffer.readUInt32LE(4) + 8 === buffer.length
  ) {
    let offset = 12,
      fmt = false,
      data = false;
    while (offset + 8 <= buffer.length) {
      const type = buffer.subarray(offset, offset + 4).toString(),
        length = buffer.readUInt32LE(offset + 4);
      if (offset + 8 + length > buffer.length) break;
      if (type === 'fmt ' && length >= 16) {
        const code = buffer.readUInt16LE(offset + 8),
          channels = buffer.readUInt16LE(offset + 10),
          rate = buffer.readUInt32LE(offset + 12);
        fmt =
          code === 1 &&
          channels >= 1 &&
          channels <= 2 &&
          rate >= 8000 &&
          rate <= 96000;
      }
      if (type === 'data' && length > 0) data = true;
      offset += 8 + length + (length % 2);
    }
    if (fmt && data && offset === buffer.length) return 'wav';
  }
  throw new ApiError(
    400,
    'INVALID_AUDIO',
    'Upload a valid bounded Opus Ogg/WebM or PCM WAV voice recording',
  );
}
