function countWords(words: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return counts;
}

const words: string[] = [];
for (let i = 0; i < 1000; i++) words.push(`w${i % 50}`);

const start = performance.now();
let distinct = 0;
for (let round = 0; round < 10_000; round++) distinct += countWords(words).size;
console.log(distinct);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
