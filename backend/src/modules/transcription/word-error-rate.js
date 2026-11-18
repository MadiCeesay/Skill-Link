// Word error rate (WER): the standard accuracy measure for speech recognition.
// WER = (substituted + deleted + inserted words) / words in the reference.
// 0 means perfect; 0.25 means one word in four is wrong.

/** Lower-cases, removes punctuation and splits into words, keeping letters from any language. */
export function words(text) {
  return String(text || '').toLowerCase().normalize('NFKC')
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .split(/\s+/).filter(Boolean);
}

/** Minimum number of word edits to turn `hypothesis` into `reference` (Levenshtein distance). */
export function wordEdits(reference, hypothesis) {
  const ref = words(reference), hyp = words(hypothesis);
  let previous = Array.from({ length: hyp.length + 1 }, (_, j) => j);
  for (let i = 1; i <= ref.length; i++) {
    const current = [i];
    for (let j = 1; j <= hyp.length; j++) {
      const substitution = previous[j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1);
      current[j] = Math.min(substitution, previous[j] + 1, current[j - 1] + 1);
    }
    previous = current;
  }
  return { edits: previous[hyp.length], referenceWords: ref.length };
}

export function wordErrorRate(reference, hypothesis) {
  const { edits, referenceWords } = wordEdits(reference, hypothesis);
  return referenceWords ? edits / referenceWords : (words(hypothesis).length ? 1 : 0);
}
