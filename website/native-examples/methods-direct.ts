class Counter {
  count = 0;

  increment(by: number): number {
    this.count += by;
    return this.count;
  }
}

const counter = new Counter();
const start = performance.now();
for (let i = 0; i < 10_000_000; i++) counter.increment(2);
console.log(counter.count);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
