function sum(values: number[]): number {
  let total = 0;
  for (let i = 0; i < values.length; i++) total += values[i]!;
  return total;
}

function sumMixed(values: (number | string)[]): number {
  let total = 0;
  for (const value of values) total += typeof value === "number" ? value : value.length;
  return total;
}

const numbers: number[] = [];
const mixed: (number | string)[] = [];
for (let i = 0; i < 1000; i++) {
  numbers.push(i);
  mixed.push(i % 2 ? i : "ab");
}

const start = performance.now();
let result = 0;
for (let round = 0; round < 10_000; round++) result += sum(numbers) + sumMixed(mixed);
console.log(result);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
