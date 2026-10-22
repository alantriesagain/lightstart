class Text {
  data: string;
  constructor(data: string) {
    this.data = data;
  }
}

class Instance {
  template: number;
  values: number;
  constructor(template: number, values: number) {
    this.template = template;
    this.values = values;
  }
}

const EMPTY = 0;
const TEXT = 2;
const TEMPLATE = 3;
const KEYED = 5;

class Part {
  kind: number;
  node: Text | null;
  text: string;
  instance: Instance | null;
  k: unknown;
  inner: Part | null;
  constructor() {
    this.kind = EMPTY;
    this.node = null;
    this.text = "";
    this.instance = null;
    this.k = null;
    this.inner = null;
  }
}

const clear = (part: Part) => {
  if (part.kind === EMPTY) return;
  if (part.kind === KEYED && part.inner !== null) clear(part.inner);
  part.kind = EMPTY;
  part.node = null;
  part.instance = null;
  part.inner = null;
};

const commitText = (part: Part, text: string) => {
  if (part.kind === TEXT && part.node !== null) {
    if (part.text !== text) {
      part.node.data = text;
      part.text = text;
    }
    return;
  }
  clear(part);
  part.kind = TEXT;
  part.node = new Text(text);
  part.text = text;
};

const commitTemplate = (part: Part, template: number, values: number) => {
  if (part.kind === TEMPLATE && part.instance !== null && part.instance.template === template) {
    part.instance.values = values;
    return;
  }
  clear(part);
  part.kind = TEMPLATE;
  part.instance = new Instance(template, values);
};

const commitKeyed = (part: Part, k: number, text: string) => {
  if (part.kind === KEYED && part.k === k && part.inner !== null) return commitText(part.inner, text);
  clear(part);
  const inner = new Part();
  commitText(inner, text);
  part.kind = KEYED;
  part.k = k;
  part.inner = inner;
};

const weigh = (part: Part): number => {
  if (part.kind === TEXT) return part.text.length;
  if (part.kind === TEMPLATE && part.instance !== null) return part.instance.values % 7;
  if (part.kind === KEYED && part.inner !== null) return 1 + weigh(part.inner);
  if (part.kind === EMPTY) return 0;
  return 100;
};

const labels = ["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta"];
const parts: Part[] = [];
for (let i = 0; i < 10_000; i++) parts.push(new Part());

const start = performance.now();
let total = 0;
for (let round = 0; round < 300; round++) {
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const pick = (i + round) % 10;
    if (pick < 6) commitText(part, labels[(i * 3 + round) % 7]);
    else if (pick < 8) commitTemplate(part, i % 3, round);
    else if (pick < 9) commitKeyed(part, i % 4, labels[round % 7]);
    else clear(part);
  }
  for (const part of parts) total += weigh(part);
}
console.log(total);
console.error(`${(performance.now() - start).toFixed(1)}`);

export {};
