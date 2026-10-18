function countMultiples(limit: number, step: number): number {
  let count = 0;
  for (let i = 0; i < limit; i++) if (i % step === 0) count++;
  return count;
}

function mean(values: number[]): number {
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

const samples: number[] = [];
for (let i = 0; i < 1000; i++) samples.push(i * 0.5);

const start = performance.now();
let result = 0;
for (let round = 0; round < 10_000; round++) result += countMultiples(1000, 7) + mean(samples);
console.log(result);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
