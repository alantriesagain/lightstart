function size(value: string | number | number[]): number {
  if (typeof value === "string") return value.length;
  if (typeof value === "number") return value;
  return value.length;
}

const values: (string | number | number[])[] = [];
for (let i = 0; i < 1000; i++) values.push(i % 3 === 0 ? "abcd" : i % 3 === 1 ? i : [1, 2]);

const start = performance.now();
let total = 0;
for (let round = 0; round < 10_000; round++) for (const value of values) total += size(value);
console.log(total);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
