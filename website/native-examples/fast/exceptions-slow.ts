function parsePositive(text: string): number {
  const value = Number(text);
  if (!(value > 0)) throw new Error(`not positive: ${text}`);
  return value;
}

const inputs: string[] = [];
for (let i = 0; i < 1000; i++) inputs.push(i % 10 === 0 ? "x" : String(i));

const start = performance.now();
let sum = 0;
let failures = 0;
for (let round = 0; round < 1000; round++)
  for (const input of inputs) {
    try {
      sum += parsePositive(input);
    } catch {
      failures++;
    }
  }
console.log(sum, failures);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
