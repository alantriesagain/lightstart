function render(names: string[]): string {
  const parts: string[] = [];
  for (const name of names) parts.push(`<li>${name}</li>`);
  return parts.join("");
}

const names: string[] = [];
for (let i = 0; i < 100; i++) names.push(`name${i}`);

const start = performance.now();
let chars = 0;
for (let round = 0; round < 10_000; round++) chars += render(names).length;
console.log(chars);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
