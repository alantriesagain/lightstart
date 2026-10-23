import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@bootstrapp/light";

const { default: dataTableDef } = await import("./data-table.js");
const { default: tableDef } = await import("./table.js");
const { default: paginationDef } = await import("../navigation/pagination.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {number} n */
const places = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Place ${String(i + 1).padStart(2, "0")}`, views: (i * 7) % 30 }));

const columns = [{ name: "Name", sortValue: (/** @type {{ name: string }} */ row) => row.name, render: (/** @type {unknown} */ _v, /** @type {{ name: string }} */ row) => row.name }, { name: "views" }];

/** The table and the one it draws both brought up to date. @param {HTMLElement & Record<string, any>} el */
const settled = async (el) => {
  await el.$requestUpdate();
  await tick();
  await /** @type {any} */ (el.querySelector("lc-table"))?.$requestUpdate();
  await tick();
};

/** @param {Record<string, unknown>} props */
const mount = async (props) => {
  const el = /** @type {HTMLElement & Record<string, any>} */ (document.createElement("lc-data-table"));
  Object.assign(el, props);
  document.body.append(el);
  mounted.push(el);
  await tick();
  await settled(el);
  return el;
};

/** @param {Element} el */
const names = (el) => [...el.querySelectorAll("tbody tr")].map((tr) => tr.querySelector("td")?.textContent?.trim());

describe("@bootstrapp/light - lc-data-table", () => {
  before(() => {
    if (!customElements.get("lc-table")) View.define("lc-table", tableDef);
    if (!customElements.get("lc-pagination")) View.define("lc-pagination", paginationDef);
    if (!customElements.get("lc-data-table")) View.define("lc-data-table", dataTableDef);
  });

  afterEach(() => { for (const el of mounted.splice(0)) el.remove(); });

  it("shows one page of the rows and names the range", async () => {
    const el = await mount({ columns, rows: places(68) });
    assert.equal(el.querySelectorAll("tbody tr").length, 25);
    assert.equal(el.querySelector(".lc-data-table-range")?.textContent?.trim(), "1–25 of 68");
    assert.ok(el.querySelector("lc-pagination"), "three pages have a pager");
  });

  it("moves between pages, and the last page holds what is left", async () => {
    /** @type {number[]} */
    const moved = [];
    const el = await mount({ columns, rows: places(68) });
    el.addEventListener("page-change", (/** @type {Event} */ e) => moved.push(/** @type {CustomEvent<{ page: number }>} */ (e).detail.page));
    el._go(3);
    await settled(el);
    assert.deepEqual([el.querySelectorAll("tbody tr").length, el.querySelector(".lc-data-table-range")?.textContent?.trim()], [18, "51–68 of 68"]);
    assert.equal(names(el)[0], "Place 51");
    el._go(9);
    assert.equal(el.page, 3, "a page past the last stays on the last");
    assert.deepEqual(moved, [3]);
  });

  it("sorts on a header click, by the column's sortValue, and starts again from the first page", async () => {
    const el = await mount({ columns, rows: places(30), page: 2 });
    const header = /** @type {HTMLElement} */ (el.querySelector("thead th"));
    header.click();
    await settled(el);
    header.click();
    await settled(el);
    assert.deepEqual([el.sortBy, el.sortDir, el.page], ["Name", "desc", 1]);
    assert.equal(names(el)[0], "Place 30");
  });

  it("goes back to the first page when the row count changes, and a smaller page size fits the rows", async () => {
    const el = await mount({ columns, rows: places(68), page: 3 });
    el.rows = places(40);
    await settled(el);
    assert.equal(el.page, 1);
    el._resize(50);
    await settled(el);
    assert.deepEqual([el.querySelectorAll("tbody tr").length, el.querySelector("lc-pagination")], [40, null], "one page needs no pager");
  });

  it("draws no footer for no rows", async () => {
    const el = await mount({ columns, rows: [], emptyMessage: "Nothing here." });
    assert.equal(el.querySelector("[data-range]"), null);
    assert.match(el.textContent ?? "", /Nothing here\./);
  });
});
