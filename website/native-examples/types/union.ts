function weight(value: boolean | string): number {
  return typeof value === "string" ? value.length : value ? 1 : 0;
}

const values: (boolean | string)[] = [];
for (let i = 0; i < 1000; i++) values.push(i % 3 === 0 ? "abc" : i % 3 === 1);

const start = performance.now();
let total = 0;
for (let round = 0; round < 10_000; round++) for (const value of values) total += weight(value);
console.log(total);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
