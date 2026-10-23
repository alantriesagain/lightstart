type StateDef = { default: unknown };

const KEYS = ["count", "label", "open", "items", "selected", "mode", "draft", "error"];

const spec: Record<string, StateDef> = {};
const values: Record<string, unknown> = {};
for (const key of KEYS) {
  spec[key] = { default: 0 };
  values[key] = 0;
}

const get = (key: string): unknown => values[key];

const set = (key: string, value: unknown): unknown => {
  if (!(key in spec)) throw new Error(`Unknown state field "${key}".`);
  const oldValue = values[key];
  if (oldValue === value) return value;
  values[key] = value;
  return value;
};

const keys = (): string[] => Object.keys(values);

const start = performance.now();
let reads = 0;
for (let i = 0; i < 2_000_000; i++) {
  const key = KEYS[i % KEYS.length];
  const current = get(key);
  set(key, (typeof current === "number" ? current : 0) + 1);
  if (i % 1000 === 0) reads += keys().length;
}
let total = reads;
for (const key of KEYS) {
  const value = get(key);
  total += typeof value === "number" ? value : 0;
}
console.log(total);
console.error(`${(performance.now() - start).toFixed(1)}`);

export {};
