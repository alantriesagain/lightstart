import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import View from "@lightstart/light";
import { register } from "./bench.js";

const COUNT = 2000;
let renderedAt = 0;

/** @param {boolean} attribute */
const define = (attribute) =>
  View.define(attribute ? "bench-reflecting" : "bench-quiet", {
    props: {
      variant: T.string({ defaultValue: "primary", attribute }),
      size: T.string({ defaultValue: "md", attribute }),
      label: T.string({ defaultValue: "Label", attribute }),
      tone: T.string({ defaultValue: "neutral", attribute }),
      open: T.boolean({ defaultValue: false, attribute }),
      busy: T.boolean({ defaultValue: true, attribute }),
    },
    updated() {
      renderedAt = performance.now();
    },
    render() {
      return html`<span>${this.label}</span>`;
    },
  });

define(true);
define(false);

const host = document.createElement("div");
document.body.append(host);
/** @type {(HTMLElement & { variant: string, size: string, label: string, open: boolean, $requestUpdate: () => Promise<void> })[]} */
let elements = [];

/** @param {string} tag */
const connect = (tag) => {
  host.replaceChildren();
  elements = Array.from({ length: COUNT }, () => /** @type {(typeof elements)[number]} */ (document.createElement(tag)));
  host.append(...elements);
};

const change = () => {
  for (const el of elements) {
    el.variant = "danger";
    el.size = "lg";
    el.label = "Changed";
    el.open = true;
  }
};

register(
  ["bench-reflecting", "bench-quiet"].flatMap((tag) => [
    { name: `connect 2k ${tag.slice(6)}`, run: () => connect(tag) },
    { name: `set 4 props ${tag.slice(6)}`, run: change },
  ]),
  async () => {
    await elements[elements.length - 1].$requestUpdate();
    return renderedAt;
  },
);
