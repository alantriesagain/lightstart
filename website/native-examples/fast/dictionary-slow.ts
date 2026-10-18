function countWords(words: string[]): number {
  const counts: Record<string, number> = {};
  for (const word of words) counts[word] = (counts[word] ?? 0) + 1;
  return Object.keys(counts).length;
}

const words: string[] = [];
for (let i = 0; i < 1000; i++) words.push(`w${i % 50}`);

const start = performance.now();
let distinct = 0;
for (let round = 0; round < 10_000; round++) distinct += countWords(words);
console.log(distinct);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
