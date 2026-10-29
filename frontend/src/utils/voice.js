export async function recordedVoice(chunks, recorderMime) {
  const mime = (chunks.find((chunk) => chunk.type)?.type || recorderMime || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!["audio/ogg", "audio/webm"].includes(mime))
    throw Error(
      "This recording format is not supported. Please attach a PCM WAV or Opus recording.",
    );
  const blob = new Blob(chunks, { type: mime });
  if (!blob.size || blob.size > 5 * 1024 * 1024)
    throw Error("Please record a shorter voice note, up to 5 MB.");
  const prefix = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  const expected =
    mime === "audio/webm" ? [0x1a, 0x45, 0xdf, 0xa3] : [79, 103, 103, 83];
  if (!expected.every((byte, i) => prefix[i] === byte))
    throw Error(
      "The browser could not finish a valid recording. Please record again.",
    );
  return new File([blob], mime === "audio/webm" ? "voice.webm" : "voice.ogg", {
    type: mime,
  });
}
