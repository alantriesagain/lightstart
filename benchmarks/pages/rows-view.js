import { html, key } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import View from "@lightstart/light";
import { register, rowSteps } from "./bench.js";

let renderedAt = 0;

View.define("bench-table", {
  props: {
    rows: T.array({ defaultValue: [], attribute: false }),
    selected: T.number({ defaultValue: 0, attribute: false }),
  },
  updated() {
    renderedAt = performance.now();
  },
  render() {
    return html`<table><tbody>${this.rows.map((row) => key(row.id, html`
      <tr class=${row.id === this.selected ? "danger" : ""}>
        <td>${row.id}</td><td><a>${row.label}</a></td><td><a>x</a></td><td></td>
      </tr>`))}</tbody></table>`;
  },
});

const table = /** @type {HTMLElement & { rows: { id: number, label: string }[], selected: number, $requestUpdate: () => Promise<void> }} */ (document.createElement("bench-table"));
document.body.append(table);

register(
  rowSteps({
    set: (rows) => { table.rows = rows; },
    get: () => table.rows,
    select: (id) => { table.selected = id; },
  }),
  async () => {
    await table.$requestUpdate();
    return renderedAt;
  },
);
