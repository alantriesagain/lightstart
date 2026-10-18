interface Shape {
  area(): number;
}

class Circle implements Shape {
  radius: number;

  constructor(radius: number) {
    this.radius = radius;
  }

  area(): number {
    return Math.PI * this.radius * this.radius;
  }
}

class Square implements Shape {
  side: number;

  constructor(side: number) {
    this.side = side;
  }

  area(): number {
    return this.side * this.side;
  }
}

const shapes: Shape[] = [];
for (let i = 0; i < 1000; i++) shapes.push(i % 2 ? new Circle(i % 5) : new Square(i % 7));

const start = performance.now();
let total = 0;
for (let round = 0; round < 10_000; round++) for (const shape of shapes) total += shape.area();
console.log(total.toFixed(2));
console.error(`${(performance.now() - start).toFixed(1)} ms`);
