class Counter {
  count = 0;

  increment(by: number): number {
    this.count += by;
    return this.count;
  }
}

const counter = new Counter();
for (let i = 0; i < 100_000; i++) counter.increment(2);
console.log(counter.count);
