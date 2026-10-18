async function load(id: number): Promise<number> {
  return id * 2;
}

async function main(): Promise<void> {
  const start = performance.now();
  let total = 0;
  for (let i = 0; i < 100_000; i++) total += await load(i);
  const all = await Promise.all([1, 2, 3].map((id) => load(id)));
  console.log(total, all.join(","));
  console.error(`${(performance.now() - start).toFixed(1)} ms`);
}

void main();
