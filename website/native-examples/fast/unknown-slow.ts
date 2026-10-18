function size(value: unknown): number {
  if (typeof value === "string") return value.length;
  if (typeof value === "number") return value;
  if (Array.isArray(value)) return value.length;
  return 0;
}

const values: unknown[] = [];
for (let i = 0; i < 1000; i++) values.push(i % 3 === 0 ? "abcd" : i % 3 === 1 ? i : [1, 2]);

const start = performance.now();
let total = 0;
for (let round = 0; round < 10_000; round++) for (const value of values) total += size(value);
console.log(total);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
