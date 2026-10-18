interface Point {
  x: number;
  y: number;
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

const points: Point[] = [];
for (let i = 0; i < 1000; i++) points.push({ x: i % 17, y: i % 29 });

const start = performance.now();
let chars = 0;
for (let round = 0; round < 10_000; round++) for (let i = 1; i < points.length; i++) chars += distance(points[i - 1]!, points[i]!);
console.log(chars.toFixed(2));
console.error(`${(performance.now() - start).toFixed(1)} ms`);
