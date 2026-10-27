import { html, key, render } from "@lightstart/light/html";
import { register, rowSteps } from "./bench.js";

/** @type {{ id: number, label: string }[]} */
let rows = [];
let selected = 0;
const container = document.createElement("div");
document.body.append(container);

const draw = () =>
  render(html`<table><tbody>${rows.map((row) => key(row.id, html`
    <tr class=${row.id === selected ? "danger" : ""}>
      <td>${row.id}</td><td><a>${row.label}</a></td><td><a>x</a></td><td></td>
    </tr>`))}</tbody></table>`, container);

register(
  rowSteps({
    set: (next) => {
      rows = next;
      draw();
    },
    get: () => rows,
    select: (id) => {
      selected = id;
      draw();
    },
  }),
  async () => performance.now(),
);
