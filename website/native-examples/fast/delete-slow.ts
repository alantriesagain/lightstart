interface Entry {
  id: number;
  label?: string;
}

function clear(entries: Entry[]): void {
  for (const entry of entries) delete entry.label;
}

function weight(entries: Entry[]): number {
  let total = 0;
  for (const entry of entries) total += entry.id + (entry.label === undefined ? 0 : 1);
  return total;
}

const start = performance.now();
let result = 0;
for (let round = 0; round < 1000; round++) {
  const entries: Entry[] = [];
  for (let i = 0; i < 1000; i++) entries.push({ id: i, label: "x" });
  clear(entries);
  result += weight(entries);
}
console.log(result);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
