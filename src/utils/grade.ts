export function getAverage(scores: number[]) {
  if (!scores.length) return 0;
  const total = scores.reduce((acc, score) => acc + score, 0);
  return Number((total / scores.length).toFixed(2));
}
