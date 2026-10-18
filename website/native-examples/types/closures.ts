function makeCounter(step: number): () => number {
  let count = 0;
  return () => (count += step);
}

const numbers: number[] = [];
for (let i = 0; i < 1000; i++) numbers.push(i);

const start = performance.now();
const next = makeCounter(2);
let result = 0;
for (let round = 0; round < 10_000; round++) {
  result += numbers
    .filter((n) => n % 3 === 0)
    .map((n) => n * 2)
    .reduce((a, b) => a + b, 0);
  result += next();
}
console.log(result);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
