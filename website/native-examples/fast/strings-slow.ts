function render(names: string[]): string {
  let out = "";
  for (const name of names) out += `<li>${name}</li>`;
  return out;
}

const names: string[] = [];
for (let i = 0; i < 100; i++) names.push(`name${i}`);

const start = performance.now();
let chars = 0;
for (let round = 0; round < 10_000; round++) chars += render(names).length;
console.log(chars);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
