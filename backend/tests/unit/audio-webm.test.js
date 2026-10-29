import { expect, it } from 'vitest';
import { audioFormat } from '../../src/modules/media/audio.validator.js';
function ebml(id, payload) {
  if (payload.length >= 127) throw Error('Fixture too long');
  return Buffer.concat([Buffer.from(id, 'hex'), Buffer.from([0x80 | payload.length]), payload]);
}
const text = s => Buffer.from(s);
function sample(codec = 'A_OPUS', type = 2, payload = 'V_ occurs in compressed audio') {
  const header = ebml('1a45dfa3', ebml('4282', text('webm')));
  const entry = ebml('ae', Buffer.concat([ebml('83', Buffer.from([type])), ebml('86', text(codec))]));
  return Buffer.concat([header, ebml('18538067', Buffer.concat([ebml('1654ae6b', entry), ebml('1f43b675', ebml('a3', text(payload)))]))]);
}
it('does not confuse arbitrary Opus payload bytes with a video track', () => {
  expect(audioFormat(sample(), 'audio/webm')).toBe('webm');
});
it('rejects actual video, incompatible audio and truncated containers', () => {
  expect(() => audioFormat(sample('V_VP8', 1), 'audio/webm')).toThrow();
  expect(() => audioFormat(sample('A_VORBIS'), 'audio/webm')).toThrow();
  expect(() => audioFormat(sample().subarray(0, -2), 'audio/webm')).toThrow();
});
