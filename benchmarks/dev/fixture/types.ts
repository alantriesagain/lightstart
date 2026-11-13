interface Point {
  x: number;
  y: number;
}

type Label = string | null;

const origin: Point = { x: 0, y: 0 };

const label = (name: Label): string => (name === null ? "unnamed" : name);

export const describe = (point: Point = origin): string => `point ${point.x},${point.y} ${label(null)}`;
