class Keyed {
  k: unknown;
  v: unknown;
  constructor(k: unknown, v: unknown) {
    this.k = k;
    this.v = v;
  }
}

class Part {
  value: unknown;
  constructor() {
    this.value = null;
  }
}

const settle = (raw: unknown[], previous: Part[]): Part[] => {
  const values: unknown[] = [];
  const keys: unknown[] = [];
  for (const item of raw)
    if (item instanceof Keyed) {
      values.push(item.v);
      keys.push(item.k);
    } else {
      values.push(item);
      keys.push(undefined);
    }
  const slots: (Part | null)[] = [];
  for (let i = 0; i < values.length; i++) slots.push(i < previous.length && keys[i] !== undefined ? previous[i] : null);
  for (let i = 0; i < slots.length; i++) {
    let part = slots[i];
    if (part === null) {
      part = new Part();
      slots[i] = part;
    }
    part.value = values[i];
  }
  const out: Part[] = [];
  for (const part of slots) {
    if (part === null) throw new Error("a hole");
    out.push(part);
  }
  return out;
};

const raw: unknown[] = [];
for (let i = 0; i < 10_000; i++) raw.push(new Keyed(i, i * 2));

const start = performance.now();
let parts: Part[] = [];
let total = 0;
for (let round = 0; round < 200; round++) {
  parts = settle(raw, parts);
  total += parts.length + (parts[round % parts.length].value as number);
}
console.log(total);
console.error(`${(performance.now() - start).toFixed(1)}`);

export {};
