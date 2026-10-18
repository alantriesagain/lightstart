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
  if (kind === 0) points.push({ x: i, y: 0 });
  else if (kind === 1) points.push({ y: 0, x: i });
  else if (kind === 2) points.push({ x: i, y: 0, tag: "a" });
  else if (kind === 3) points.push({ tag: "b", x: i, y: 0 });
  else if (kind === 4) points.push({ x: i, y: 0, z: 1 });
  else points.push({ z: 1, y: 0, x: i });
}

const start = performance.now();
let result = 0;
for (let round = 0; round < 20_000; round++) result += sumX(points);
console.log(result);
console.error(`${(performance.now() - start).toFixed(1)} ms`);
