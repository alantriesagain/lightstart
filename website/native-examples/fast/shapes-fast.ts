interface Point {
  x: number;
  y: number;
  tag?: string;
  z?: number;
}

function sumX(points: Point[]): number {
  let total = 0;
  for (const point of points) total += point.x;
  return total;
}

const points: Point[] = [];
for (let i = 0; i < 1200; i++) {
  const kind = i % 6;
  points.push({ x: i, y: 0, tag: kind === 2 ? "a" : kind === 3 ? "b" : undefined, z: kind >= 4 ? 1 : undefined });
}

const start = performance.now();
let result = 0;
for (let round = 0; round < 20_000; round++) result += sumX(points);
console.log(result);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
