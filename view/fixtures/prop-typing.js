/**
 * What `this` reads for each kind of `props` entry, held by the type checker:
 * `npm run typecheck` fails when a line below stops meaning what it says.
 */

import View from "../index.js";
import T from "../../types/index.js";

/** @typedef {{ name: string }} User */
/** @typedef {"grid" | "list"} Layout */

View.define("fx-prop-typing", {
  count: 0,
  label: "",
  open: false,
  items: [],
  rows: /** @type {User[]} */ ([]),
  user: /** @type {User | null} */ (null),
  layout: /** @type {Layout} */ ("grid"),
  signal: /** @type {AbortSignal | null} */ (null),
  table: /** @type {Map<string, User>} */ (new Map()),
  title: T.string(),
}, {
  render() {
    /** @type {number} */ const count = this.count;
    /** @type {string} */ const label = this.label;
    /** @type {boolean} */ const open = this.open;
    /** @type {unknown[]} */ const items = this.items;
    /** @type {User[]} */ const rows = this.rows;
    /** @type {User | null} */ const user = this.user;
    /** @type {Layout} */ const layout = this.layout;
    /** @type {AbortSignal | null} */ const signal = this.signal;
    /** @type {Map<string, User>} */ const table = this.table;
    /** @type {string} */ const title = this.title;
    // @ts-expect-error a union default stays the union
    this.layout = "cards";
    // @ts-expect-error a cast default keeps its element type
    this.rows = [1];
    return [count, label, open, items, rows, user, layout, signal, table, title];
  },
});
