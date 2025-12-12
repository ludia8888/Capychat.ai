export function normalizeWordSet(text: string): Set<string> {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^0-9a-z\uac00-\ud7a3\s]/gi, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

export function similarityScore(a: string, b: string): number {
  const setA = normalizeWordSet(a);
  const setB = normalizeWordSet(b);
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  setA.forEach((v) => {
    if (setB.has(v)) inter += 1;
  });
  const union = setA.size + setB.size - inter;
  return inter / union;
}
