import { element, html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import View from "@lightstart/light";
import { register } from "./bench.js";

let leafAt = 0;

View.define("bench-node", {
  props: {
    depth: T.number({ defaultValue: 0, attribute: false }),
    value: T.string({ defaultValue: "", attribute: false }),
  },
  render() {
    if (this.depth > 0) return element("bench-node", { ".depth": this.depth - 1, ".value": this.value });
    leafAt = performance.now();
    return html`<span>${this.value}</span>`;
  },
});

/** @type {(HTMLElement & { depth: number, value: string, $requestUpdate: () => Promise<void> }) | null} */
let root = null;

/** @param {number} depth */
const mount = (depth) => {
  root?.remove();
  const next = /** @type {HTMLElement & { depth: number, value: string, $requestUpdate: () => Promise<void> }} */ (document.createElement("bench-node"));
  next.depth = depth;
  next.value = "a";
  document.body.append(next);
  root = next;
};

register(
  [5, 20, 50].flatMap((depth) => [
    { name: `mount depth ${depth}`, run: () => mount(depth) },
    { name: `update depth ${depth}`, run: () => { if (root) root.value = root.value === "a" ? "b" : "a"; } },
  ]),
  async () => {
    await root?.$requestUpdate();
    return leafAt;
  },
);
