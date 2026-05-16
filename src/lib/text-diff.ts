/**
 * Cheap text-similarity helpers — no LLM tokens needed.
 *
 * `computeEditRatio` returns a 0..1 number where:
 *   0     → strings are identical
 *   0.05  → trivial whitespace / punctuation tweak
 *   0.3+  → user materially rewrote the draft
 *   1     → completely replaced
 *
 * We use this to decide whether an edit pair is worth using as a few-shot
 * example (only meaningful edits, not ones that are essentially the same).
 */

/** Levenshtein distance between two strings (iterative DP, two-row table). */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Truncate to a reasonable size — we don't need exact distance for novels.
  const A = a.length > 4000 ? a.slice(0, 4000) : a;
  const B = b.length > 4000 ? b.slice(0, 4000) : b;

  let prev = new Array(B.length + 1);
  let curr = new Array(B.length + 1);
  for (let j = 0; j <= B.length; j++) prev[j] = j;

  for (let i = 1; i <= A.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= B.length; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1, // insertion
        prev[j] + 1, // deletion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[B.length];
}

export function computeEditRatio(original: string, edited: string): number {
  const o = original ?? "";
  const e = edited ?? "";
  if (o === e) return 0;
  const distance = levenshtein(o.toLowerCase(), e.toLowerCase());
  const ratio = distance / Math.max(o.length, e.length, 1);
  return Math.min(1, Math.max(0, ratio));
}
