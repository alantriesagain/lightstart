interface Circle {
  kind: "circle";
  radius: number;
}

interface Square {
  kind: "square";
  side: number;
}

type Shape = Circle | Square;

function area(shape: Shape): number {
  return shape.kind === "circle" ? Math.PI * shape.radius * shape.radius : shape.side * shape.side;
}

const shapes: Shape[] = [];
for (let i = 0; i < 1000; i++) shapes.push(i % 2 ? { kind: "circle", radius: i % 5 } : { kind: "square", side: i % 7 });

const start = performance.now();
let total = 0;
for (let round = 0; round < 10_000; round++) for (const shape of shapes) total += area(shape);
console.log(total.toFixed(2));
console.error(`${(performance.now() - start).toFixed(1)} ms`);
