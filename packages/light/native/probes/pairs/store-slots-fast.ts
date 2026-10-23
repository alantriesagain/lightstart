class StateDef {
  default: unknown;
  constructor(value: unknown) {
    this.default = value;
  }
}

const KEYS = ["count", "label", "open", "items", "selected", "mode", "draft", "error"];

class Slot {
  def: StateDef;
  value: unknown;
  constructor(def: StateDef, value: unknown) {
    this.def = def;
    this.value = value;
  }
}

const slots: Map<string, Slot> = new Map();
for (const key of KEYS) slots.set(key, new Slot(new StateDef(0), 0));
const keyList = [...slots.keys()];

const get = (key: string): unknown => {
  const slot = slots.get(key);
  return slot === undefined ? undefined : slot.value;
};

const set = (key: string, value: unknown): unknown => {
  const slot = slots.get(key);
  if (slot === undefined) throw new Error(`Unknown state field "${key}".`);
  if (slot.value === value) return value;
  slot.value = value;
  return value;
};

const keys = (): string[] => keyList.slice();

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
