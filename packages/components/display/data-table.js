import { html } from "@lightstart/light/html";
import T from "@lightstart/light/types";
import { defineComponent } from "@lightstart/light";
import { isModelApi, modelApi } from "@lightstart/light/model";
import { modelQuery } from "@lightstart/light/model/binder";
import { lcText } from "../utils/text.js";
import { clampPage, pageCount, pageRows, rangeOf, sortRows } from "../utils/table-rows.js";

/** @import { DataTableQuery, Prop, TableColumn, TableRow, TableRowSelect, TableRowSelected } from "../types.ts" */
/** @import { ModelQueryResource } from "@lightstart/light/model" */

const TAG = /** @type {const} */ ("lc-data-table");

/**
 * A table that pages, sorts and says where it is. It holds the rows it is
 * handed, or pages a model through `query`; a header click sorts by that
 * column (its `sortValue`, else the field it names) or orders the query; one
 * page shows at a time, with a footer naming the range, the pages and how
 * many rows a page holds. The page is the table's own state rather than the
 * address, so it works in a workbench tab as it does on a page, and it goes
 * back to the first page when the row count, the sort, the query or the page
 * size changes.
 */
export default defineComponent({
  tag: "lc-data-table",
  style: true,
  props: {
    columns: /** @type {Prop<(string | TableColumn)[]>} */ (T.array({ defaultValue: [] })),
    rows: /** @type {Prop<TableRow[]>} */ (T.array({ defaultValue: [] })),
    query: /** @type {Prop<DataTableQuery | null>} */ (T.object({ attribute: false, defaultValue: null })),
    pageSize: 25,
    pageSizes: /** @type {Prop<number[]>} */ (T.array({ defaultValue: [25, 50, 100] })),
    page: 1,
    sortBy: "",
    sortDir: T.string({ defaultValue: "asc", enum: ["asc", "desc"] }),
    sortable: true,
    selectRow: /** @type {Prop<TableRowSelect | null>} */ (T.function()),
    isSelected: /** @type {Prop<TableRowSelected | null>} */ (T.function()),
    emptyMessage: "",
    compact: false,
    _queryKey: T.string({ reactive: false, defaultValue: "" }),
    _resource: /** @type {Prop<ModelQueryResource<Record<string, unknown>> | null>} */ (T.object({ reactive: false, defaultValue: null })),
    _queryOffs: /** @type {Prop<Array<() => void>>} */ (T.array({ reactive: false, defaultValue: [] })),
  },
  events: {
    "page-change": T.object({ page: T.number(), pageSize: T.number() }),
    sort: T.object({ sortBy: T.string(), sortDir: T.string() }),
  },

  connected() {
    // A remount starts the query again: the last disconnect disposed it.
    this._syncQuery();
    this.$own(() => this._disposeQuery());
  },

  /** @param {{ changedProps: Map<string, unknown> }} detail */
  willUpdate({ changedProps }) {
    const before = /** @type {TableRow[] | undefined} */ (changedProps.get("rows"));
    const recount = changedProps.has("rows") && before !== undefined && before.length !== this.rows.length;
    const reorder = ["sortBy", "sortDir", "pageSize"].some((name) => changedProps.has(name) && changedProps.get(name) !== undefined);
    const requery = changedProps.has("query") && changedProps.get("query") !== undefined && JSON.stringify(changedProps.get("query")) !== JSON.stringify(this.query);
    if (recount || reorder || requery) this.page = 1;
    this._syncQuery();
  },

  _syncQuery() {
    const query = this.query;
    if (!query?.model) {
      if (this._resource !== null) {
        this._disposeQuery();
        this._queryKey = "";
      }
      return;
    }
    const api = typeof query.model === "string" ? modelApi(query.model, () => undefined) : query.model;
    if (!isModelApi(api)) return;
    const key = JSON.stringify([api.name, query.where ?? null, query.includes ?? null, this.page, this.pageSize, this.sortBy, this.sortDir]);
    if (key === this._queryKey && this._resource !== null) return;
    this._queryKey = key;
    this._disposeQuery();
    const resource = modelQuery(api, {
      where: query.where,
      includes: query.includes,
      order: this.sortBy ? (this.sortDir === "desc" ? `-${this.sortBy}` : this.sortBy) : undefined,
      limit: this.pageSize,
      offset: (this.page - 1) * this.pageSize,
    });
    const update = () => this.$requestUpdate();
    this._resource = resource;
    this._queryOffs = [resource.value.subscribe(update), resource.pending.subscribe(update), resource.error.subscribe(update)];
    resource.ensure().catch(() => {});
  },

  _disposeQuery() {
    const offs = this._queryOffs;
    this._queryOffs = [];
    for (const off of offs) off();
    const resource = this._resource;
    this._resource = null;
    resource?.dispose();
  },

  _count() {
    if (this.query?.model) {
      const resource = this._resource;
      return resource !== null ? resource.total : 0;
    }
    return this.rows.length;
  },

  _queryRows() {
    const resource = this._resource;
    const rows = resource !== null ? resource.value.value : undefined;
    return Array.isArray(rows) ? /** @type {TableRow[]} */ (rows) : [];
  },

  _emptyMessage() {
    const resource = this._resource;
    if (resource === null) return this.emptyMessage;
    if (resource.error.value) return lcText(TAG, "failed");
    if (resource.pending.value && this._queryRows().length === 0) return lcText(TAG, "loading");
    return this.emptyMessage;
  },

  /** @param {number} page */
  _go(page) {
    const next = clampPage(page, this._count(), this.pageSize);
    if (next === this.page) return;
    this.page = next;
    this.$emit("page-change", { page: next, pageSize: this.pageSize });
  },

  /** @param {number} size */
  _resize(size) {
    if (!(size > 0) || size === this.pageSize) return;
    this.pageSize = size;
    this.$emit("page-change", { page: 1, pageSize: size });
  },

  /** @param {CustomEvent<{ sortBy: string, sortDir: string }>} e */
  _sort(e) {
    e.stopPropagation();
    this.sortBy = e.detail.sortBy;
    this.sortDir = e.detail.sortDir;
    this.$emit("sort", { sortBy: this.sortBy, sortDir: this.sortDir });
  },

  _renderFooter() {
    const count = this._count();
    if (!count) return "";
    const pages = pageCount(count, this.pageSize);
    const page = clampPage(this.page, count, this.pageSize);
    const sizes = this.pageSizes.filter((size) => size > 0);
    return html`
      <div class="lc-data-table-footer" data-range>
        <span class="lc-data-table-range">${lcText(TAG, "range", rangeOf(page, this.pageSize, count))}</span>
        ${sizes.length > 1 && count > Math.min(...sizes) ? html`
          <label class="lc-data-table-size">
            <span>${lcText(TAG, "perPage")}</span>
            <lc-select size="sm" data-page-size .value=${String(this.pageSize)} .options=${sizes.map((size) => ({ value: String(size), label: String(size) }))}
              @change=${(/** @type {CustomEvent<{ value: string }>} */ e) => this._resize(Number(e.detail.value))}></lc-select>
          </label>
        ` : ""}
        ${pages > 1 ? html`<lc-pagination size="sm" .current=${page} .total=${pages} @change=${(/** @type {CustomEvent<{ page: number }>} */ e) => this._go(e.detail.page)}></lc-pagination>` : ""}
      </div>
    `;
  },

  render() {
    const sort = (/** @type {CustomEvent<{ sortBy: string, sortDir: string }>} */ e) => this._sort(e);
    const querying = Boolean(this.query?.model);
    const page = clampPage(this.page, this._count(), this.pageSize);
    const rows = querying
      ? this._queryRows()
      : pageRows(sortRows(this.rows, this.columns, this.sortBy, this.sortDir), page, this.pageSize);
    return html`
      <lc-table
        .columns=${this.columns}
        .rows=${rows}
        .selectRow=${this.selectRow}
        .isSelected=${this.isSelected}
        ?sortable=${this.sortable}
        .sortBy=${this.sortBy}
        .sortDir=${this.sortDir}
        .emptyMessage=${this._emptyMessage()}
        ?compact=${this.compact}
        @sort=${sort}
      ></lc-table>
      ${this._renderFooter()}
    `;
  },
});
