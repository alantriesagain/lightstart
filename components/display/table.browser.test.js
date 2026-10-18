import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: tableDef } = await import("./table.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

describe("@bootstrapp/light - lc-table", () => {
  before(() => {
    if (!customElements.get("lc-table")) View.define("lc-table", tableDef);
  });

  afterEach(() => { for (const el of mounted.splice(0)) el.remove(); });

  it("draws a column's render, hands a clicked row over, and marks the row isSelected names", async () => {
    const el = /** @type {HTMLElement & Record<string, unknown> & { $requestUpdate: () => Promise<unknown> }} */ (document.createElement("lc-table"));
    /** @type {unknown[]} */
    const picked = [];
    el.columns = [{ name: "Name" }, { name: "Amount", render: (/** @type {unknown} */ _v, /** @type {{ cents: number }} */ row) => `R$ ${row.cents / 100}` }];
    el.rows = [{ id: "a", Name: "Ana", cents: 4900 }, { id: "b", Name: "Bia", cents: 2900 }];
    el.selectRow = (/** @type {{ id: string }} */ row) => picked.push(row.id);
    el.isSelected = (/** @type {{ id: string }} */ row) => row.id === "b";
    document.body.append(el);
    mounted.push(el);
    await tick();
    await el.$requestUpdate();
    const rows = [...el.querySelectorAll("tbody tr")];
    assert.deepEqual(rows.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent?.trim())), [["Ana", "R$ 49"], ["Bia", "R$ 29"]]);
    assert.deepEqual(rows.map((tr) => tr.classList.contains("is-selected")), [false, true]);
    /** @type {HTMLElement} */ (rows[0]).click();
    assert.deepEqual(picked, ["a"]);
  });

  it("heads a column with its label and fills it from the field it names", async () => {
    const el = /** @type {HTMLElement & Record<string, unknown> & { $requestUpdate: () => Promise<unknown> }} */ (document.createElement("lc-table"));
    el.columns = [{ name: "ip", label: "IP Address" }, { name: "hits" }];
    el.rows = [{ ip: "10.0.0.1", hits: 3 }];
    document.body.append(el);
    mounted.push(el);
    await tick();
    await el.$requestUpdate();
    assert.deepEqual([...el.querySelectorAll("thead th")].map((th) => th.textContent?.trim()), ["IP Address", "hits"]);
    assert.deepEqual([...el.querySelectorAll("tbody td")].map((td) => td.textContent?.trim()), ["10.0.0.1", "3"]);
  });

  it("leaves the header of a column with no name empty", async () => {
    const el = /** @type {HTMLElement & Record<string, unknown> & { $requestUpdate: () => Promise<unknown> }} */ (document.createElement("lc-table"));
    el.columns = [{ name: "Name" }, { name: "", render: () => "Active" }];
    el.rows = [{ id: "a", Name: "Ana" }];
    document.body.append(el);
    mounted.push(el);
    await tick();
    await el.$requestUpdate();
    assert.deepEqual([...el.querySelectorAll("thead th")].map((th) => th.textContent?.trim()), ["Name", ""]);
  });
});
