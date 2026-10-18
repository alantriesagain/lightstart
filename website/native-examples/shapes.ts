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
  return shape.kind === "circle" ? Math.PI * shape.radius ** 2 : shape.side ** 2;
}

function total<T>(items: T[], measure: (item: T) => number): number {
  let sum = 0;
  for (const item of items) sum += measure(item);
  return sum;
}

const shapes: Shape[] = [];
for (let i = 0; i < 50_000; i++) shapes.push({ kind: "circle", radius: i % 10 });
console.log(total(shapes, area).toFixed(2));
for (let i = 0; i < 50_000; i++) shapes.push({ kind: "square", side: i % 10 });
console.log(total(shapes, area).toFixed(2));
