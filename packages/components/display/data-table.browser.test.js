import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import View from "@lightstart/light";
import T from "@lightstart/light/types";
import { configureModel, defineModel } from "@lightstart/light/model";
import { createStore, storeRequest } from "@lightstart/light/model/store";

const { default: dataTableDef } = await import("./data-table.js");
const { default: tableDef } = await import("./table.js");
const { default: paginationDef } = await import("../navigation/pagination.js");

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** @type {Element[]} */
const mounted = [];

/** @param {number} n */
const places = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Place ${String(i + 1).padStart(2, "0")}`, views: (i * 7) % 30 }));

const columns = [{ name: "Name", sortValue: (/** @type {{ name: string }} */ row) => row.name, render: (/** @type {unknown} */ _v, /** @type {{ name: string }} */ row) => row.name }, { name: "views" }];

const memory = () => {
  /** @type {Map<string, Map<string, Record<string, unknown>>>} */
  const tables = new Map();
  /** @param {string} model */
  const table = (model) => {
    if (!tables.has(model)) tables.set(model, new Map());
    return /** @type {Map<string, Record<string, unknown>>} */ (tables.get(model));
  };
  return {
    async init() {},
    async get(model, id) { return table(model).get(String(id)) ?? null; },
    async query(model, /** @type {Record<string, any>} */ opts = {}) {
      let rows = [...table(model).values()];
      const where = opts.where;
      if (where)
        rows = rows.filter((row) => Object.entries(where).every(([field, value]) => row[field] === value));
      if (opts.order) {
        const parts = String(opts.order).split(",").map((part) => part.trim());
        rows.sort((a, b) => {
          for (const part of parts) {
            const desc = part.startsWith("-");
            const [field = ""] = (desc ? part.slice(1) : part).split(/\s+/);
            const direction = desc ? -1 : 1;
            const left = a[field];
            const right = b[field];
            if (left === right) continue;
            return (left < right ? -1 : 1) * direction;
          }
          return 0;
        });
      }
      const total = rows.length;
      const offset = opts.offset ?? 0;
      const limit = opts.limit;
      rows = rows.slice(offset, limit === undefined ? undefined : offset + limit);
      return { rows, total };
    },
    async insert(model, row) { table(model).set(String(row.id), row); return row; },
    async update(model, row) { table(model).set(String(row.id), row); return row; },
    async delete(model, id) { return table(model).delete(String(id)); },
    async count(model, where) { return (await this.query(model, { where })).total; },
    async close() {},
  };
};

/** A model of places over a memory store. @param {number} count */
const openPlaces = async (count) => {
  const place = defineModel("place", { name: T.string(), views: T.number() });
  const store = createStore({ models: { place: place.schema }, databases: { memory: memory() }, defaultAdapter: "memory" });
  configureModel({ request: storeRequest(store) });
  await place.addMany(Array.from({ length: count }, (_, i) => ({ name: `Place ${String(i + 1).padStart(2, "0")}`, views: i + 1 })));
  return { place, store };
};

/** @param {HTMLElement & Record<string, any>} el @param {() => boolean} done */
const waitFor = async (el, done) => {
  for (let tries = 0; tries < 100; tries++) {
    await tick();
    await el.$requestUpdate();
    if (done()) return;
  }
};

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

describe("@lightstart/light - lc-data-table", () => {
  before(() => {
    if (!customElements.get("lc-table")) View.define("lc-table", tableDef);
    if (!customElements.get("lc-pagination")) View.define("lc-pagination", paginationDef);
    if (!customElements.get("lc-data-table")) View.define("lc-data-table", dataTableDef);
  });

  afterEach(() => {
    for (const el of mounted.splice(0)) el.remove();
    configureModel();
  });

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

  it("loads a model query one page at a time and names the whole match", async () => {
    const { place } = await openPlaces(30);
    const el = await mount({ columns, query: { model: place } });
    await waitFor(el, () => el.querySelector(".lc-data-table-range") !== null);
    assert.deepEqual([el.querySelectorAll("tbody tr").length, el.querySelector(".lc-data-table-range")?.textContent?.trim()], [25, "1–25 of 30"]);
    el._go(2);
    await waitFor(el, () => el.querySelectorAll("tbody tr").length === 5);
    assert.deepEqual([names(el)[0], el.querySelector(".lc-data-table-range")?.textContent?.trim()], ["Place 26", "26–30 of 30"]);
  });

  it("orders the query when a header is clicked", async () => {
    const { place } = await openPlaces(30);
    const el = await mount({ columns, query: { model: place } });
    await waitFor(el, () => el.querySelectorAll("tbody tr").length === 25);
    const headers = /** @type {HTMLElement[]} */ ([...el.querySelectorAll("thead th")]);
    headers[1].click();
    await waitFor(el, () => names(el)[0] === "Place 01");
    assert.deepEqual([el.sortBy, el.sortDir, names(el)[0]], ["views", "asc", "Place 01"]);
    headers[1].click();
    await waitFor(el, () => names(el)[0] === "Place 30");
    assert.deepEqual([el.sortDir, names(el)[0]], ["desc", "Place 30"]);
  });

  it("counts a row added through the model", async () => {
    const { place } = await openPlaces(30);
    const el = await mount({ columns, query: { model: place } });
    await waitFor(el, () => el.querySelector(".lc-data-table-range")?.textContent?.trim() === "1–25 of 30");
    await place.add({ name: "Place 31", views: 31 });
    await waitFor(el, () => el.querySelector(".lc-data-table-range")?.textContent?.trim() === "1–25 of 31");
    assert.equal(el.querySelector(".lc-data-table-range")?.textContent?.trim(), "1–25 of 31");
  });

  it("resolves a model named as a string", async () => {
    const { place } = await openPlaces(12);
    assert.equal(place.name, "place");
    const el = await mount({ columns, query: { model: "place" }, pageSize: 10 });
    await waitFor(el, () => el.querySelectorAll("tbody tr").length === 10);
    assert.deepEqual([el.querySelectorAll("tbody tr").length, el.querySelector(".lc-data-table-range")?.textContent?.trim()], [10, "1–10 of 12"]);
  });
});
