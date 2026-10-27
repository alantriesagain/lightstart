/**
 * withDiff: given an `original`, the editor shows how its document differs
 * from it. Inserted lines and changed characters are marked in place,
 * deleted lines appear as read-only blocks where they were, and every hunk
 * can be reverted (put the original back) or accepted (make the original
 * match). `toPatch()` answers the unified diff of the two.
 */

/** @import { EditorMixinDefinition, Hunk, Decoration, Doc } from "../types.js" */
import { computed, signal } from "/app/light/signals/index.js";
import T from "/app/light/types/types.js";
import { defineMixin } from "/app/light/view/index.js";
import { block, lineClass, mark } from "../decorations.js";
import { diffChars, diffLines } from "../diff.js";
import { line as lineOf, lineNumberAt } from "../document.js";
import { formatPatch } from "../patch.js";

const CHAR_DIFF_MAX_LINES = 8;

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
const handle = (value) => ({ reactive: false, defaultValue: value });

/**
 * @param {string[]} lines
 * @returns {() => Element}
 */
const deletedBlock = (lines) => () => {
  const el = document.createElement("div");
  el.className = "ed-diff-delete";
  for (const text of lines) {
    const row = document.createElement("div");
    row.className = "ed-diff-delete-line";
    row.textContent = text || " ";
    el.appendChild(row);
  }
  return el;
};

/**
 * @param {string[]} aLines
 * @param {Doc} doc
 * @param {Hunk} h
 * @returns {Decoration[]}
 */
const hunkDecorations = (aLines, doc, h) => {
  /** @type {Decoration[]} */
  const out = [];
  if (h.type === "equal") return out;
  for (let n = h.bFrom + 1; n <= h.bTo; n++) out.push(lineClass(n, h.type === "insert" ? "ed-diff-insert" : "ed-diff-change"));
  if (h.type === "replace" && h.aTo - h.aFrom === h.bTo - h.bFrom && h.bTo - h.bFrom <= CHAR_DIFF_MAX_LINES)
    for (let i = 0; i < h.bTo - h.bFrom; i++) {
      const l = lineOf(doc, h.bFrom + 1 + i);
      for (const c of diffChars(aLines[h.aFrom + i], l.text))
        if (c.type !== "equal" && c.bTo > c.bFrom) out.push(mark(l.from + c.bFrom, l.from + c.bTo, { class: "ed-diff-change-text" }));
    }
  if (h.aTo > h.aFrom && h.type !== "replace") {
    const deleted = aLines.slice(h.aFrom, h.aTo);
    const key = `del:${h.bFrom}:${deleted.join("\n")}`;
    if (h.bFrom < doc.lineCount) out.push(block(h.bFrom + 1, { widget: deletedBlock(deleted), side: "above", key }));
    else out.push(block(doc.lineCount, { widget: deletedBlock(deleted), side: "below", key }));
  } else if (h.type === "replace" && h.aTo - h.aFrom !== h.bTo - h.bFrom) {
    const deleted = aLines.slice(h.aFrom, h.aTo);
    out.push(block(h.bFrom + 1, { widget: deletedBlock(deleted), side: "above", key: `del:${h.bFrom}:${deleted.join("\n")}` }));
  } else if (h.type === "replace") {
    const deleted = aLines.slice(h.aFrom, h.aTo);
    out.push(block(h.bFrom + 1, { widget: deletedBlock(deleted), side: "above", key: `del:${h.bFrom}:${deleted.join("\n")}` }));
  }
  return out;
};

export const withDiff = defineMixin(/** @satisfies {EditorMixinDefinition} */ ({
  props: {
    original: T.string({ defaultValue: null }),
    _edOriginal: T.object(handle(null)),
    _edHunks: T.object(handle(null)),
  },
  events: {
    hunks: T.object({ count: T.number() }),
  },

  get hunks() {
    return /** @type {Hunk[]} */ (this._edHunks ? this._edHunks.value : []);
  },

  get changedHunks() {
    return this.hunks.filter((/** @type {Hunk} */ h) => h.type !== "equal");
  },

  connected() {
    this._edOriginal = signal(typeof this.original === "string" ? this.original : null);
    this._edHunks = computed(() => {
      const original = /** @type {string | null} */ (this._edOriginal.value);
      const doc = /** @type {Doc} */ (this._edDoc.value);
      return original === null ? [] : diffLines(original.split("\n"), doc.lines);
    });
    let last = -1;
    this.$own(
      this._edHunks.subscribe((/** @type {Hunk[]} */ hunks) => {
        const count = hunks.filter((h) => h.type !== "equal").length;
        if (count !== last) {
          last = count;
          this.$emit("hunks", { count });
        }
      }),
    );
    this.$own(this.addDecorator(() => this.diffDecorations()));
  },

  diffDecorations() {
    const original = /** @type {string | null} */ (this._edOriginal.value);
    if (original === null) return [];
    const aLines = original.split("\n");
    const doc = this.doc;
    const { first, last } = this.windowLines();
    /** @type {Decoration[]} */
    const out = [];
    for (const h of /** @type {Hunk[]} */ (this._edHunks.value)) {
      if (h.type === "equal") continue;
      if (h.bTo + 1 < first || h.bFrom + 1 > last + 1) continue;
      out.push(...hunkDecorations(aLines, doc, h));
    }
    return out;
  },

  /**
   * @param {number} index into `changedHunks`
   * @returns {boolean}
   */
  revertHunk(index) {
    const original = /** @type {string | null} */ (this._edOriginal.value);
    const h = this.changedHunks[index];
    if (original === null || !h) return false;
    const aLines = original.split("\n");
    const doc = this.doc;
    const insert = aLines.slice(h.aFrom, h.aTo).join("\n");
    /** @type {{ from: number, to?: number, insert?: string }} */
    let change;
    if (h.type === "insert")
      if (h.bFrom > 0) change = { from: lineOf(doc, h.bFrom).to, to: lineOf(doc, h.bTo).to };
      else if (h.bTo < doc.lineCount) change = { from: 0, to: lineOf(doc, h.bTo + 1).from };
      else change = { from: 0, to: doc.length };
     else if (h.type === "delete")
      change = h.bFrom < doc.lineCount ? { from: lineOf(doc, h.bFrom + 1).from, insert: `${insert}\n` } : { from: doc.length, insert: `\n${insert}` };
     else change = { from: lineOf(doc, h.bFrom + 1).from, to: lineOf(doc, h.bTo).to, insert };
    this.dispatch({ changes: change, selection: { anchor: change.from }, origin: "api", scrollIntoView: true });
    return true;
  },

  /**
   * @param {number} index into `changedHunks`
   * @returns {boolean}
   */
  acceptHunk(index) {
    const original = /** @type {string | null} */ (this._edOriginal.value);
    const h = this.changedHunks[index];
    if (original === null || !h) return false;
    const aLines = original.split("\n");
    const bLines = this.doc.lines.slice(h.bFrom, h.bTo);
    aLines.splice(h.aFrom, h.aTo - h.aFrom, ...bLines);
    this.original = aLines.join("\n");
    return true;
  },

  /**
   * @param {number} delta
   * @returns {boolean}
   */
  moveHunk(delta) {
    const hunks = /** @type {Hunk[]} */ (this.changedHunks);
    if (!hunks.length) return false;
    const current = lineNumberAt(this.doc, this.selection.head) - 1;
    let index = delta > 0 ? hunks.findIndex((h) => h.bFrom > current) : -1;
    if (delta < 0) for (let i = hunks.length - 1; i >= 0; i--) if (hunks[i].bFrom < current) {
      index = i;
      break;
    }
    if (index === -1) index = delta > 0 ? 0 : hunks.length - 1;
    const target = Math.min(hunks[index].bFrom + 1, this.doc.lineCount);
    this.dispatch({ selection: { anchor: lineOf(this.doc, target).from }, scrollIntoView: { y: "center" }, origin: "api" });
    return true;
  },

  nextHunk() {
    return this.moveHunk(1);
  },

  prevHunk() {
    return this.moveHunk(-1);
  },

  /**
   * @param {{ oldPath?: string, newPath?: string, context?: number }} [options]
   * @returns {string}
   */
  toPatch(options = {}) {
    const original = /** @type {string | null} */ (this._edOriginal.value);
    if (original === null) return "";
    return formatPatch(original, this.text, { oldPath: options.oldPath ?? this.path ?? "a", newPath: options.newPath ?? this.path ?? "b", context: options.context });
  },

  /** @param {{ changedProps: Map<string, unknown> }} detail */
  updated({ changedProps }) {
    if (changedProps.has("original") && this._edOriginal) this._edOriginal.value = typeof this.original === "string" ? this.original : null;
  },
}));
