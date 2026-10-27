import { configure, html, key, render } from "@lightstart/light/html";
import { effect, selector, signal } from "@lightstart/light/signals";
import { register, rowSteps } from "./bench.js";

configure({ effect });

/** @typedef {{ id: number, label: import("@lightstart/light/signals").Signal<string>, view?: unknown }} Row */

/** @type {Row[]} */
let rows = [];
const selected = signal(0);
const isSelected = selector(selected);
const container = document.createElement("div");
document.body.append(container);

/** @param {Row} row */
const rowView = (row) => html`
  <tr class=${() => (isSelected(row.id) ? "danger" : "")}>
    <td>${row.id}</td><td><a>${() => row.label.value}</a></td><td><a>x</a></td><td></td>
  </tr>`;

const draw = () => render(html`<table><tbody>${rows.map((row) => key(row.id, (row.view ??= rowView(row))))}</tbody></table>`, container);

register(
  rowSteps({
    set: (next) => {
      rows = next;
      draw();
    },
    get: () => rows,
    select: (id) => { selected.value = id; },
    make: (data) => data.map(({ id, label }) => ({ id, label: signal(label) })),
    relabel: (every) => {
      for (let i = 0; i < rows.length; i += every) rows[i].label.value += " !!!";
    },
  }),
  async () => performance.now(),
);
