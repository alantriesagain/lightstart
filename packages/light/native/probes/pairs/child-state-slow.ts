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

class Part {
  state: State;
  constructor() {
    this.state = { type: "empty" };
  }
}

type State =
  | { type: "empty" }
  | { type: "pending" }
  | { type: "text"; node: Text; text: string }
  | { type: "template"; instance: Instance }
  | { type: "items"; parts: Part[]; keys: unknown[] | null }
  | { type: "keyed"; k: unknown; inner: Part }
  | { type: "node"; node: Text }
  | { type: "unsafe"; s: string }
  | { type: "element"; tag: string; el: Text; committed: Map<string, unknown> };

const clear = (part: Part) => {
  const st = part.state;
  if (st.type === "empty") return;
  if (st.type === "keyed") clear(st.inner);
  else if (st.type === "items") for (const child of st.parts) clear(child);
  part.state = { type: "empty" };
};

const commitText = (part: Part, text: string) => {
  const st = part.state;
  if (st.type === "text") {
    if (st.text !== text) {
      st.node.data = text;
      st.text = text;
    }
    return;
  }
  clear(part);
  part.state = { type: "text", node: new Text(text), text };
};

const commitTemplate = (part: Part, template: number, values: number) => {
  const st = part.state;
  if (st.type === "template" && st.instance.template === template) {
    st.instance.values = values;
    return;
  }
  clear(part);
  part.state = { type: "template", instance: new Instance(template, values) };
};

const commitKeyed = (part: Part, k: number, text: string) => {
  const st = part.state;
  if (st.type === "keyed" && st.k === k) return commitText(st.inner, text);
  clear(part);
  const inner = new Part();
  commitText(inner, text);
  part.state = { type: "keyed", k, inner };
};

const weigh = (part: Part): number => {
  const st = part.state;
  if (st.type === "text") return st.text.length;
  if (st.type === "template") return st.instance.values % 7;
  if (st.type === "keyed") return 1 + weigh(st.inner);
  if (st.type === "empty") return 0;
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
