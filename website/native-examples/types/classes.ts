class Vector {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  add(other: Vector): Vector {
    return new Vector(this.x + other.x, this.y + other.y);
  }

  get length(): number {
    return Math.hypot(this.x, this.y);
  }
}

const start = performance.now();
let sum = new Vector(0, 0);
const step = new Vector(0.5, 0.25);
for (let i = 0; i < 10_000_000; i++) sum = sum.add(step);
console.log(sum.length.toFixed(2));
console.error(`${(performance.now() - start).toFixed(1)} ms`);
