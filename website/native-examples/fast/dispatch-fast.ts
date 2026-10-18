class Counter {
  count = 0;

  increment(by: number): number {
    this.count += by;
    return this.count;
  }
}

function save(settings: Map<string, unknown>, key: string, value: unknown): void {
  settings.set(key, value);
}
save(new Map(), "theme", "dark");

const counter = new Counter();
const start = performance.now();
for (let i = 0; i < 10_000_000; i++) counter.increment(2);
console.log(counter.count);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
