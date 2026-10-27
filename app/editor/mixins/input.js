/**
 * withInput: everything the user does to the content layer. Cancelable
 * `beforeinput` events become transactions; composition runs natively and
 * is reconciled from the DOM when it ends; a MutationObserver reconciles
 * whatever else the browser changed on its own (Android keyboards,
 * autocorrect). Clipboard, drag and drop, Tab, Enter, undo and the
 * registered keymaps are handled on their own events.
 */

/** @import { EditorMixinDefinition, Transaction } from "../types.js" */
import T from "/app/light/types/types.js";
import { defineMixin } from "/app/light/view/index.js";
import * as commands from "../commands.js";
import { diffText } from "../diff.js";
import { line as lineOf, lineNumberAt, selection as makeSelection } from "../document.js";
import { keyName, runKeymap } from "../keymap.js";
import { lineElementOf, textOfLine } from "./dom.js";

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
const handle = (value) => ({ reactive: false, defaultValue: value });

const DELETE_TYPES = new Set([
  "deleteContentBackward",
  "deleteContentForward",
  "deleteWordBackward",
  "deleteWordForward",
  "deleteSoftLineBackward",
  "deleteSoftLineForward",
  "deleteHardLineBackward",
  "deleteHardLineForward",
  "deleteContent",
  "deleteEntireSoftLine",
]);

export const withInput = defineMixin(/** @satisfies {EditorMixinDefinition} */ ({
  props: {
    _edEscaped: T.boolean(handle(false)),
    _edDragRange: T.object(handle(null)),
    _edMutations: T.object(handle(null)),
  },

  connected() {
    const content = /** @type {HTMLElement} */ (this._edContent);
    const on = (/** @type {string} */ type, /** @type {(e: Event) => void} */ fn, /** @type {AddEventListenerOptions} */ options = {}) => {
      content.addEventListener(type, fn, options);
      this.$own(() => content.removeEventListener(type, fn, options));
    };
    on("beforeinput", (e) => this.onBeforeInput(/** @type {InputEvent} */ (e)));
    on("keydown", (e) => this.onKeyDown(/** @type {KeyboardEvent} */ (e)));
    on("compositionstart", () => {
      this._edComposing = true;
    });
    on("compositionend", () => {
      this._edComposing = false;
      this.reconcileLine(this.selection.head, "composition");
    });
    on("copy", (e) => this.onCopy(/** @type {ClipboardEvent} */ (e), false));
    on("cut", (e) => this.onCopy(/** @type {ClipboardEvent} */ (e), true));
    on("paste", (e) => this.onPaste(/** @type {ClipboardEvent} */ (e)));
    on("dragstart", () => {
      this._edDragRange = this.selection.empty ? null : { from: this.selection.from, to: this.selection.to };
    });
    on("dragend", () => {
      this._edDragRange = null;
    });
    on("drop", (e) => this.onDrop(/** @type {DragEvent} */ (e)));
    on("focusin", () => {
      this._edFocusValue = this.text;
    });
    on("focusout", () => {
      const before = this._edFocusValue;
      this._edFocusValue = null;
      const value = this.text;
      if (before !== null && before !== value) this.$emit("change", { value });
    });
    const onSelectionChange = () => {
      if (this._edRendering || this._edComposing || !this.hasFocus) return;
      const sel = this.readDomSelection();
      if (!sel) return;
      const current = this.selection;
      if (sel.anchor === current.anchor && sel.head === current.head) return;
      this.dispatch({ selection: { anchor: sel.anchor, head: sel.head }, origin: "dom" });
    };
    document.addEventListener("selectionchange", onSelectionChange);
    this.$own(() => document.removeEventListener("selectionchange", onSelectionChange));
    if (typeof MutationObserver === "function") {
      const observer = new MutationObserver((records) => this.onMutations(records));
      observer.observe(content, { childList: true, characterData: true, subtree: true });
      this._edMutations = observer;
      this.$own(() => {
        observer.disconnect();
        this._edMutations = null;
      });
    }
  },

  /**
   * @param {InputEvent} e
   */
  onBeforeInput(e) {
    const type = e.inputType;
    if (type === "insertCompositionText" || type === "deleteCompositionText") return;
    if (this.readonly) {
      e.preventDefault();
      return;
    }
    if (type === "insertText" || type === "insertTranspose" || type === "insertFromYank") {
      e.preventDefault();
      this.insertTyped(e.data ?? "");
      return;
    }
    if (type === "insertReplacementText") {
      e.preventDefault();
      const range = this.targetRange(e);
      const text = e.dataTransfer?.getData("text/plain") ?? e.data ?? "";
      this.dispatch({ changes: { from: range.from, to: range.to, insert: text }, selection: { anchor: range.from + text.length }, origin: "input", scrollIntoView: true });
      return;
    }
    if (type === "insertParagraph" || type === "insertLineBreak") {
      e.preventDefault();
      this.run(commands.insertNewlineAndIndent);
      return;
    }
    if (DELETE_TYPES.has(type)) {
      e.preventDefault();
      const sel = this.selection;
      if (!sel.empty) {
        this.dispatch({ changes: { from: sel.from, to: sel.to }, selection: { anchor: sel.from }, origin: "delete", scrollIntoView: true });
        return;
      }
      const targets = e.getTargetRanges ? e.getTargetRanges() : [];
      if (targets.length) {
        const range = this.targetRange(e);
        if (range.to > range.from) {
          this.dispatch({ changes: { from: range.from, to: range.to }, selection: { anchor: range.from }, origin: "delete", scrollIntoView: true });
          return;
        }
      }
      const command = type === "deleteWordBackward" ? commands.deleteGroupBackward
        : type === "deleteWordForward" ? commands.deleteGroupForward
        : type === "deleteContentForward" ? commands.deleteCharForward
        : type === "deleteSoftLineBackward" || type === "deleteHardLineBackward" ? (/** @type {import("../types.js").EditorState} */ s) => ({ changes: { from: lineOf(s.doc, lineNumberAt(s.doc, s.selection.head)).from, to: s.selection.head }, selection: { anchor: lineOf(s.doc, lineNumberAt(s.doc, s.selection.head)).from }, origin: "delete" })
        : type === "deleteSoftLineForward" || type === "deleteHardLineForward" ? (/** @type {import("../types.js").EditorState} */ s) => ({ changes: { from: s.selection.head, to: lineOf(s.doc, lineNumberAt(s.doc, s.selection.head)).to }, origin: "delete" })
        : commands.deleteCharBackward;
      this.run(command);
      return;
    }
    if (type === "historyUndo") {
      e.preventDefault();
      this.undo();
      return;
    }
    if (type === "historyRedo") {
      e.preventDefault();
      this.redo();
      return;
    }
    e.preventDefault();
  },

  /**
   * @param {InputEvent} e
   * @returns {{ from: number, to: number }}
   */
  targetRange(e) {
    const targets = e.getTargetRanges ? e.getTargetRanges() : [];
    const range = targets[0];
    if (!range) return { from: this.selection.from, to: this.selection.to };
    const from = this.domPointToPos(range.startContainer, range.startOffset);
    const to = this.domPointToPos(range.endContainer, range.endOffset);
    return { from: Math.min(from, to), to: Math.max(from, to) };
  },

  /**
   * Text the user typed: registered input handlers get the first word.
   * @param {string} text
   */
  insertTyped(text) {
    const sel = this.selection;
    for (const handler of this._edRegistries.inputHandlers) if (handler(this, text, sel.from, sel.to)) return;
    this.run((/** @type {import("../types.js").EditorState} */ state) => commands.insertText(state, text));
  },

  /**
   * @param {KeyboardEvent} e
   */
  onKeyDown(e) {
    if (this._edComposing || e.isComposing) return;
    const name = keyName(e);
    if (runKeymap(this._edRegistries.keymaps, name, this)) {
      e.preventDefault();
      return;
    }
    if (name === "Escape") {
      this._edEscaped = true;
      return;
    }
    if (name === "Tab" || name === "Shift-Tab") {
      if (this._edEscaped) {
        this._edEscaped = false;
        return;
      }
      if (this.readonly) return;
      e.preventDefault();
      const sel = this.selection;
      const multiline = !sel.empty && lineNumberAt(this.doc, sel.from) !== lineNumberAt(this.doc, sel.to);
      if (name === "Shift-Tab") this.run(commands.indentLess);
      else if (multiline) this.run(commands.indentMore);
      else this.run((/** @type {import("../types.js").EditorState} */ state, /** @type {import("../types.js").CommandContext} */ ctx) => commands.insertText(state, ctx.indentUnit));
      return;
    }
    this._edEscaped = false;
    if (name === "Enter" || name === "Shift-Enter") {
      if (this.readonly) return;
      e.preventDefault();
      this.run(commands.insertNewlineAndIndent);
      return;
    }
    if (name === "Ctrl-z" || name === "Meta-z") {
      e.preventDefault();
      this.undo();
      return;
    }
    if (name === "Ctrl-Shift-z" || name === "Shift-Meta-z" || name === "Ctrl-y") {
      e.preventDefault();
      this.redo();
    }
  },

  /**
   * @param {ClipboardEvent} e
   * @param {boolean} cut
   */
  onCopy(e, cut) {
    const sel = this.selection;
    if (sel.empty) return;
    e.preventDefault();
    e.clipboardData?.setData("text/plain", this.sliceString(sel.from, sel.to));
    if (cut && !this.readonly) this.dispatch({ changes: { from: sel.from, to: sel.to }, selection: { anchor: sel.from }, origin: "delete", scrollIntoView: true });
  },

  /**
   * @param {ClipboardEvent} e
   */
  onPaste(e) {
    e.preventDefault();
    if (this.readonly) return;
    const text = (e.clipboardData?.getData("text/plain") ?? "").replace(/\r\n?/g, "\n");
    if (!text) return;
    const sel = this.selection;
    this.dispatch({ changes: { from: sel.from, to: sel.to, insert: text }, selection: { anchor: sel.from + text.length }, origin: "paste", scrollIntoView: true });
  },

  /**
   * @param {DragEvent} e
   */
  onDrop(e) {
    e.preventDefault();
    if (this.readonly) return;
    const text = (e.dataTransfer?.getData("text/plain") ?? "").replace(/\r\n?/g, "\n");
    if (!text) return;
    const at = this.posAtCoords({ x: e.clientX, y: e.clientY });
    if (at == null) return;
    const source = /** @type {{ from: number, to: number } | null} */ (this._edDragRange);
    this._edDragRange = null;
    /** @type {import("../types.js").Change[]} */
    const changes = [{ from: at, insert: text }];
    let cursor = at + text.length;
    if (source && !e.ctrlKey && !e.altKey) {
      if (at >= source.from && at <= source.to) return;
      changes.push({ from: source.from, to: source.to });
      if (at > source.to) cursor -= source.to - source.from;
    }
    this.dispatch({ changes, selection: { anchor: cursor }, origin: "drop", scrollIntoView: true });
    this.focusEditor();
  },

  /**
   * Read a rendered line back into the document.
   * @param {number} pos a position on the line
   * @param {import("../types.js").Origin} origin
   */
  reconcileLine(pos, origin) {
    const l = this.lineAt(pos);
    const el = this.lineElement(l.number);
    if (!el) return;
    const shown = textOfLine(el);
    if (shown === l.text) {
      const sel = this.readDomSelection();
      if (sel) this.dispatch({ selection: { anchor: sel.anchor, head: sel.head }, origin: "dom" });
      return;
    }
    const changes = diffText(l.text, shown).map((c) => ({ from: l.from + c.from, to: l.from + (c.to ?? c.from), insert: c.insert }));
    const sel = this.readDomSelection();
    this.dispatch({ changes, selection: sel ? { anchor: sel.anchor, head: sel.head } : undefined, origin });
    delete (/** @type {HTMLElement & { _ed?: unknown }} */ (el))._ed;
    this._edTick.value++;
  },

  /**
   * @param {MutationRecord[]} records
   */
  onMutations(records) {
    if (this._edRendering || this._edComposing) return;
    const lines = new Set();
    let structural = false;
    for (const r of records) {
      const target = /** @type {Node} */ (r.target);
      const element = target.nodeType === Node.ELEMENT_NODE ? /** @type {Element} */ (target) : target.parentElement;
      const lineEl = lineElementOf(element);
      if (lineEl) lines.add(lineEl);
      else structural = true;
    }
    if (structural) {
      this.refreshLines();
      return;
    }
    for (const el of lines) {
      const n = Number(el.dataset.ln);
      if (!n) continue;
      const l = this.line(Math.min(n, this.doc.lineCount));
      if (textOfLine(el) !== l.text) this.reconcileLine(l.from, "dom");
    }
  },

  /**
   * @param {Transaction | null} tr
   * @returns {import("../types.js").Selection}
   */
  selectionAfter(tr) {
    return tr ? tr.state.selection : makeSelection(0);
  },
}));
