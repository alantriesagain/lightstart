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

class EmptyState {}
class PendingState {}

class TextState {
  node: Text;
  text: string;
  constructor(node: Text, text: string) {
    this.node = node;
    this.text = text;
  }
}

class TemplateState {
  instance: Instance;
  constructor(instance: Instance) {
    this.instance = instance;
  }
}

class ItemsState {
  parts: Part[];
  keys: unknown[];
  constructor(parts: Part[], keys: unknown[]) {
    this.parts = parts;
    this.keys = keys;
  }
}

class KeyedState {
  k: unknown;
  inner: Part;
  constructor(k: unknown, inner: Part) {
    this.k = k;
    this.inner = inner;
  }
}

class NodeState {
  node: Text;
  constructor(node: Text) {
    this.node = node;
  }
}

class UnsafeState {
  s: string;
  constructor(s: string) {
    this.s = s;
  }
}

class ElementState {
  tag: string;
  el: Text;
  committed: Map<string, unknown>;
  constructor(tag: string, el: Text) {
    this.tag = tag;
    this.el = el;
    this.committed = new Map();
  }
}

type State = EmptyState | PendingState | TextState | TemplateState | ItemsState | KeyedState | NodeState | UnsafeState | ElementState;

const EMPTY = new EmptyState();
const unusedKinds: State[] = [new PendingState(), new ItemsState([], []), new NodeState(new Text("")), new UnsafeState(""), new ElementState("div", new Text(""))];
if (unusedKinds.length !== 5) throw new Error("every state kind is built once");

class Part {
  state: State;
  constructor() {
    this.state = EMPTY;
  }
}

const clear = (part: Part) => {
  const st = part.state;
  if (st === EMPTY) return;
  if (st instanceof KeyedState) clear(st.inner);
  else if (st instanceof ItemsState) for (const child of st.parts) clear(child);
  part.state = EMPTY;
};

const commitText = (part: Part, text: string) => {
  const st = part.state;
  if (st instanceof TextState) {
    if (st.text !== text) {
      st.node.data = text;
      st.text = text;
    }
    return;
  }
  clear(part);
  part.state = new TextState(new Text(text), text);
};

const commitTemplate = (part: Part, template: number, values: number) => {
  const st = part.state;
  if (st instanceof TemplateState && st.instance.template === template) {
    st.instance.values = values;
    return;
  }
  clear(part);
  part.state = new TemplateState(new Instance(template, values));
};

const commitKeyed = (part: Part, k: number, text: string) => {
  const st = part.state;
  if (st instanceof KeyedState && st.k === k) return commitText(st.inner, text);
  clear(part);
  const inner = new Part();
  commitText(inner, text);
  part.state = new KeyedState(k, inner);
};

const weigh = (part: Part): number => {
  const st = part.state;
  if (st instanceof TextState) return st.text.length;
  if (st instanceof TemplateState) return st.instance.values % 7;
  if (st instanceof KeyedState) return 1 + weigh(st.inner);
  if (st === EMPTY) return 0;
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
