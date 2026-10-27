import { html, key } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import View from "@lightstart/light";
import { register, rowSteps } from "./bench.js";

let renderedAt = 0;

View.define("bench-row", {
  props: {
    row: T.object({ defaultValue: null, attribute: false }),
    selected: false,
  },
  updated() {
    renderedAt = performance.now();
  },
  render() {
    const { row } = /** @type {{ row: { id: number, label: string } }} */ (/** @type {unknown} */ (this));
    return html`<td>${row.id}</td><td><a>${row.label}</a></td><td><a>x</a></td><td></td>`;
  },
});

View.define("bench-table", {
  props: {
    rows: T.array({ defaultValue: [], attribute: false }),
    selected: T.number({ defaultValue: 0, attribute: false }),
  },
  updated() {
    renderedAt = performance.now();
  },
  render() {
    return html`<table><tbody>${this.rows.map((row) => key(row.id, html`<bench-row .row=${row} ?selected=${row.id === this.selected}></bench-row>`))}</tbody></table>`;
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
