/**
 * withSearch: find and replace with the method contract the IDE drives.
 * Matches are a computed over the document and the query, so highlights
 * survive edits; the decorator only marks the rendered window.
 */

/** @import { EditorMixinDefinition, SearchOptions, SearchMatch } from "../types.js" */
import { computed, signal } from "/app/light/signals/index.js";
import T from "/app/light/types/types.js";
import { defineMixin } from "/app/light/view/index.js";
import { mark } from "../decorations.js";
import { findMatches, nearestMatch } from "../search.js";

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
const handle = (value) => ({ reactive: false, defaultValue: value });

export const withSearch = defineMixin(/** @satisfies {EditorMixinDefinition} */ ({
  props: {
    _edQuery: T.object(handle(null)),
    _edMatches: T.object(handle(null)),
    _edMatchIndex: T.object(handle(null)),
  },

  connected() {
    this._edQuery = signal(/** @type {{ query: string, options: SearchOptions } | null} */ (null));
    this._edMatchIndex = signal(-1);
    this._edMatches = computed(() => {
      const q = this._edQuery.value;
      return q ? findMatches(this._edDoc.value, q.query, q.options) : [];
    });
    this.$own(this.addDecorator(() => this.searchDecorations()));
  },

  /** @returns {SearchMatch[]} */
  get findMatches() {
    return this._edMatches.value;
  },

  get currentFindIndex() {
    return this._edMatchIndex.value;
  },

  searchDecorations() {
    const matches = /** @type {SearchMatch[]} */ (this._edMatches.value);
    if (!matches.length) return [];
    const index = this._edMatchIndex.value;
    const { from, to } = this.windowRange();
    /** @type {import("../types.js").Decoration[]} */
    const out = [];
    matches.forEach((m, i) => {
      if (m.to < from || m.from > to) return;
      out.push(mark(m.from, m.to, { class: i === index ? "ed-search-current" : "ed-search" }));
    });
    return out;
  },

  /**
   * @param {number} index
   * @returns {{ currentMatch: number, totalMatches: number }}
   */
  selectMatch(index) {
    const matches = /** @type {SearchMatch[]} */ (this._edMatches.value);
    this._edMatchIndex.value = index;
    const m = matches[index];
    if (m) this.dispatch({ selection: { anchor: m.from, head: m.to }, scrollIntoView: { y: "center" }, origin: "api" });
    return { currentMatch: matches.length ? index + 1 : 0, totalMatches: matches.length };
  },

  /**
   * @param {string} query
   * @param {SearchOptions} [options]
   * @returns {{ currentMatch: number, totalMatches: number }}
   */
  find(query, options = {}) {
    if (!query) {
      this.clearFindDecorations();
      return { currentMatch: 0, totalMatches: 0 };
    }
    this._edQuery.value = { query, options: { matchCase: !!options.matchCase, useRegex: !!options.useRegex, wholeWord: !!options.wholeWord } };
    const matches = /** @type {SearchMatch[]} */ (this._edMatches.value);
    if (!matches.length) {
      this._edMatchIndex.value = -1;
      return { currentMatch: 0, totalMatches: 0 };
    }
    return this.selectMatch(nearestMatch(matches, this.selection.head));
  },

  /**
   * @param {string} query
   * @param {SearchOptions} [options]
   */
  findNext(query, options = {}) {
    const q = this._edQuery.peek();
    if (!q || q.query !== query || !this._edMatches.value.length) return this.find(query, options);
    return this.selectMatch((this._edMatchIndex.peek() + 1) % this._edMatches.value.length);
  },

  /**
   * @param {string} query
   * @param {SearchOptions} [options]
   */
  findPrevious(query, options = {}) {
    const q = this._edQuery.peek();
    if (!q || q.query !== query || !this._edMatches.value.length) return this.find(query, options);
    const count = this._edMatches.value.length;
    return this.selectMatch((this._edMatchIndex.peek() - 1 + count) % count);
  },

  /**
   * @param {string} findQuery
   * @param {string} replaceQuery
   * @param {SearchOptions} [options]
   */
  replaceNext(findQuery, replaceQuery, options = {}) {
    const q = this._edQuery.peek();
    if (!q || q.query !== findQuery || this._edMatchIndex.peek() < 0) return this.find(findQuery, options);
    const matches = /** @type {SearchMatch[]} */ (this._edMatches.value);
    const current = matches[this._edMatchIndex.peek()];
    if (!current) return this.find(findQuery, options);
    this.dispatch({ changes: { from: current.from, to: current.to, insert: replaceQuery }, origin: "api" });
    const next = /** @type {SearchMatch[]} */ (this._edMatches.value);
    if (!next.length) {
      this._edMatchIndex.value = -1;
      return { currentMatch: 0, totalMatches: 0 };
    }
    const at = next.findIndex((m) => m.from >= current.from);
    return this.selectMatch(at === -1 ? 0 : at);
  },

  /**
   * @param {string} findQuery
   * @param {string} replaceQuery
   * @param {SearchOptions} [options]
   * @returns {number}
   */
  replaceAll(findQuery, replaceQuery, options = {}) {
    this.find(findQuery, options);
    const matches = /** @type {SearchMatch[]} */ (this._edMatches.value);
    if (!matches.length) return 0;
    const count = matches.length;
    this.dispatch({ changes: matches.map((m) => ({ from: m.from, to: m.to, insert: replaceQuery })), origin: "api" });
    this.clearFindDecorations();
    return count;
  },

  clearFindDecorations() {
    this._edQuery.value = null;
    this._edMatchIndex.value = -1;
  },
}));
