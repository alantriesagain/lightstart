/**
 * What `<lc-data-table>` does to the rows it holds, as pure functions: the
 * value a column sorts by, the rows in a column's order, how many pages they
 * make, one page of them, and the range a footer names.
 */

/** @import { TableColumn, TableRow } from "../types.ts" */

/** @param {string | TableColumn} column */
export const columnName = (column) => (typeof column === "string" ? column : column.name);

/**
 * What a row sorts by under a column: the column's `sortValue`, else the
 * field the column names, else what its cell draws when that is text or a
 * number. A cell drawn as markup sorts as empty unless the column says what
 * to sort it by.
 * @param {TableRow} row
 * @param {string | TableColumn} column
 * @returns {unknown}
 */
export const sortValueOf = (row, column) => {
  if (typeof column === "object" && column.sortValue) return column.sortValue(row);
  const value = row[columnName(column)];
  if (value !== undefined || typeof column !== "object" || !column.render) return value;
  const drawn = column.render(undefined, row);
  return typeof drawn === "string" || typeof drawn === "number" ? drawn : undefined;
};

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

/** @param {unknown} value */
const isEmpty = (value) => value === null || value === undefined || value === "" || (typeof value === "number" && Number.isNaN(value));

/** @param {unknown} a @param {unknown} b */
const compare = (a, b) => {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" || typeof b === "boolean") return Number(a) - Number(b);
  return collator.compare(String(a), String(b));
};

/**
 * The rows in a column's order, the way it was asked, an empty value last
 * either way and rows that tie in the order they came. No column named by
 * `sortBy` leaves them as they are.
 * @param {TableRow[]} rows
 * @param {(string | TableColumn)[]} columns
 * @param {string} sortBy
 * @param {string} sortDir `asc` or `desc`
 * @returns {TableRow[]}
 */
export const sortRows = (rows, columns, sortBy, sortDir) => {
  const column = sortBy ? columns.find((c) => columnName(c) === sortBy) : null;
  if (!column) return rows;
  const dir = sortDir === "desc" ? -1 : 1;
  return rows
    .map((row, i) => ({ row, i, value: sortValueOf(row, column) }))
    .sort((a, b) => {
      const emptyA = isEmpty(a.value);
      const emptyB = isEmpty(b.value);
      if (emptyA || emptyB) return emptyA === emptyB ? a.i - b.i : emptyA ? 1 : -1;
      return compare(a.value, b.value) * dir || a.i - b.i;
    })
    .map(({ row }) => row);
};

/** How many pages `total` rows make at `size` a page, at least one. @param {number} total @param {number} size */
export const pageCount = (total, size) => Math.max(1, Math.ceil(total / Math.max(1, size)));

/** A page number kept inside the pages there are. @param {number} page @param {number} total @param {number} size */
export const clampPage = (page, total, size) => Math.min(Math.max(1, Math.floor(page) || 1), pageCount(total, size));

/**
 * One page of rows.
 * @template T
 * @param {T[]} rows @param {number} page @param {number} size
 * @returns {T[]}
 */
export const pageRows = (rows, page, size) => rows.slice((page - 1) * size, page * size);

/**
 * The rows a page shows, counted from one, and how many there are in all.
 * @param {number} page @param {number} size @param {number} total
 */
export const rangeOf = (page, size, total) => (total > 0 ? { from: (page - 1) * size + 1, to: Math.min(total, page * size), total } : { from: 0, to: 0, total: 0 });
