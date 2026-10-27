/**
 * withDocument: the editor's state as a component mixin. The document and
 * selection are signals; `dispatch(spec)` applies a transaction, records it
 * in history and emits the typed `input` and `cursor` events. Extensions
 * register through the `add*` registries, each answering a teardown for
 * `this.$own(...)`. The imperative command surface the IDE drives lives here.
 */

/** @import { EditorHost, EditorMixinDefinition, EditorState, TransactionSpec, Transaction, Selection, Decoration, Keymap, Language, History } from "../types.js" */
import { batch, signal } from "/app/light/signals/index.js";
import T from "/app/light/types/types.js";
import { defineMixin } from "/app/light/view/index.js";
import * as commands from "../commands.js";
import { diffText } from "../diff.js";
import { docText, line, lineAt, sliceString } from "../document.js";
import { createHistory, record, redo, undo } from "../history.js";
import { normalizeKeymap } from "../keymap.js";
import { byName, languageForPath } from "../lang/index.js";
import { applyTransaction, createState } from "../transaction.js";

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
const handle = (value) => ({ reactive: false, defaultValue: value });

export const withDocument = defineMixin(/** @satisfies {EditorMixinDefinition} */ ({
  props: {
    value: T.string({
      defaultValue: "",
      /** @this {EditorHost} */
      getter() {
        if (!this._edState) return this._edPendingValue ?? "";
        return docText(this.doc);
      },
      /**
       * @this {EditorHost}
       * @param {unknown} text
       */
      setter(text) {
        const next = text == null ? "" : String(text);
        if (!this._edState) {
          this._edPendingValue = next;
          return;
        }
        this.setText(next);
      },
    }),
    readonly: false,
    language: T.string(),
    path: T.string(),
    indentStyle: "space",
    indentSize: 2,
    _edState: T.object(handle(null)),
    _edDoc: T.object(handle(null)),
    _edSelection: T.object(handle(null)),
    _edTransaction: T.object(handle(null)),
    _edHistory: T.object(handle(null)),
    _edLanguage: T.object(handle(null)),
    _edRegistries: T.object(handle(null)),
    _edPlugins: T.object(handle(null)),
    _edMark: T.number(handle(null)),
    _edFocusValue: T.string(handle(null)),
    _edPendingValue: T.string(handle(null)),
  },
  events: {
    input: T.object({ value: T.string(), changes: T.array() }),
    change: T.object({ value: T.string() }),
    cursor: T.object({ line: T.number(), column: T.number(), position: T.number() }),
  },

  get editorState() {
    return /** @type {EditorState} */ (this._edState);
  },

  get doc() {
    return /** @type {EditorState} */ (this._edState).doc;
  },

  get selection() {
    return /** @type {EditorState} */ (this._edState).selection;
  },

  get text() {
    return docText(this.doc);
  },

  get editorLanguage() {
    return /** @type {Language | null} */ (this._edLanguage);
  },

  get commandContext() {
    const language = /** @type {Language | null} */ (this._edLanguage);
    return {
      indentUnit: this.indentStyle === "tab" ? "\t" : " ".repeat(this.indentSize),
      tabSize: this.indentSize,
      indentAfter: language ? language.indentAfter : undefined,
    };
  },

  connected() {
    if (!this._edState) this.initDocument();
  },

  initDocument() {
    const stored = typeof this.$state?.get === "function" ? this.$state.get("value") : undefined;
    const state = createState(this._edPendingValue ?? (typeof stored === "string" ? stored : ""));
    this._edPendingValue = null;
    this._edState = state;
    this._edDoc = signal(state.doc);
    this._edSelection = signal(state.selection);
    this._edHistory = createHistory();
    this._edPlugins = signal(0);
    this._edRegistries = { decorators: new Set(), keymaps: [], inputHandlers: [], tooltips: [], completions: [] };
    this._edLanguage = byName(this.language) ?? languageForPath(this.path);
    this._edFocusValue = null;
  },

  /**
   * @param {TransactionSpec} spec
   * @returns {Transaction | null}
   */
  dispatch(spec) {
    const state = /** @type {EditorState} */ (this._edState);
    if (this.readonly && spec.changes && spec.origin !== "api") return null;
    const tr = applyTransaction(state, spec);
    if (!tr.docChanged && !tr.selectionSet && !tr.scrollIntoView) return null;
    this._edState = tr.state;
    this._edTransaction = tr;
    if (tr.docChanged) this._edHistory = record(/** @type {History} */ (this._edHistory), tr);
    batch(() => {
      this._edDoc.value = tr.state.doc;
      this._edSelection.value = tr.state.selection;
    });
    if (tr.docChanged) {
      const doc = tr.state.doc;
      const detail = { changes: tr.changes };
      Object.defineProperty(detail, "value", { enumerable: true, get: () => docText(doc) });
      this.$emit("input", detail);
    }
    if (tr.selectionSet) {
      const head = tr.state.selection.head;
      const l = lineAt(tr.state.doc, head);
      this.$emit("cursor", { line: l.number, column: head - l.from + 1, position: head });
    }
    return tr;
  },

  /**
   * Replace the whole text with the fewest changes that get there.
   * @param {string} text
   * @param {import("../types.js").Origin} [origin]
   */
  setText(text, origin = "api") {
    const current = docText(this.doc);
    if (current === text) return;
    this.dispatch({ changes: diffText(current, text), origin });
  },

  /**
   * @param {string | null | undefined} name
   * @param {string | null | undefined} [path]
   */
  setLanguage(name, path) {
    this._edLanguage = byName(name) ?? languageForPath(path ?? this.path);
    this._edPlugins.value++;
  },

  refreshPlugins() {
    this._edPlugins.value++;
  },

  /**
   * @param {(editor: unknown) => Decoration[]} fn
   * @returns {() => void}
   */
  addDecorator(fn) {
    this._edRegistries.decorators.add(fn);
    this._edPlugins.value++;
    return () => {
      this._edRegistries.decorators.delete(fn);
      this._edPlugins.value++;
    };
  },

  /**
   * @param {Keymap<unknown>} bindings
   * @returns {() => void}
   */
  addKeymap(bindings) {
    const map = normalizeKeymap(bindings);
    this._edRegistries.keymaps.push(map);
    return () => {
      const i = this._edRegistries.keymaps.indexOf(map);
      if (i !== -1) this._edRegistries.keymaps.splice(i, 1);
    };
  },

  /**
   * @param {(editor: unknown, text: string, from: number, to: number) => boolean} fn
   * @returns {() => void}
   */
  addInputHandler(fn) {
    this._edRegistries.inputHandlers.push(fn);
    return () => {
      const i = this._edRegistries.inputHandlers.indexOf(fn);
      if (i !== -1) this._edRegistries.inputHandlers.splice(i, 1);
    };
  },

  /**
   * @param {(editor: unknown) => ({ pos: number, render: () => unknown } | null)} fn
   * @returns {() => void}
   */
  addTooltip(fn) {
    this._edRegistries.tooltips.push(fn);
    this._edPlugins.value++;
    return () => {
      const i = this._edRegistries.tooltips.indexOf(fn);
      if (i !== -1) this._edRegistries.tooltips.splice(i, 1);
      this._edPlugins.value++;
    };
  },

  /**
   * @param {(editor: unknown) => unknown} fn
   * @returns {() => void}
   */
  addCompletionSource(fn) {
    this._edRegistries.completions.push(fn);
    return () => {
      const i = this._edRegistries.completions.indexOf(fn);
      if (i !== -1) this._edRegistries.completions.splice(i, 1);
    };
  },

  /**
   * @param {(state: EditorState, ctx: import("../types.js").CommandContext) => TransactionSpec | null} command
   * @returns {boolean}
   */
  run(command) {
    const spec = command(this.editorState, this.commandContext);
    if (!spec) return false;
    this.dispatch(spec);
    return true;
  },

  undo() {
    const move = undo(/** @type {History} */ (this._edHistory));
    if (!move) return false;
    this._edHistory = move.history;
    this.applyMove(move);
    return true;
  },

  redo() {
    const move = redo(/** @type {History} */ (this._edHistory));
    if (!move) return false;
    this._edHistory = move.history;
    this.applyMove(move);
    return true;
  },

  /**
   * @param {import("../types.js").HistoryMove} move
   */
  applyMove(move) {
    const last = move.changes.length - 1;
    move.changes.forEach((changes, i) =>
      this.dispatch({
        changes,
        origin: "history",
        addToHistory: false,
        selection: i === last ? { anchor: move.selection.anchor, head: move.selection.head } : undefined,
        scrollIntoView: i === last,
      }),
    );
  },

  /** @param {number} pos */
  lineAt(pos) {
    return lineAt(this.doc, pos);
  },

  /** @param {number} n */
  line(n) {
    return line(this.doc, n);
  },

  /**
   * @param {number} from
   * @param {number} [to]
   */
  sliceString(from, to) {
    return sliceString(this.doc, from, to);
  },

  /** @param {number | null | undefined} position */
  setCursorPosition(position) {
    if (position == null) return;
    const pos = Math.min(Math.max(0, position), this.doc.length);
    this.dispatch({ selection: { anchor: pos }, scrollIntoView: true, origin: "api" });
  },

  /** @param {number} number */
  goToLine(number) {
    if (number < 1 || number > this.doc.lineCount) return;
    this.dispatch({ selection: { anchor: line(this.doc, number).from }, scrollIntoView: { y: "center" }, origin: "api" });
    this.focusEditor();
  },

  /** @param {string} text */
  insertTextAtCursor(text) {
    const sel = this.selection;
    this.dispatch({ changes: { from: sel.from, to: sel.to, insert: text }, selection: { anchor: sel.from + text.length }, scrollIntoView: true, origin: "api" });
    this.focusEditor();
  },

  beginningOfLine() { this.run(commands.cursorLineStart); },
  endOfLine() { this.run(commands.cursorLineEnd); },
  nextLine() { this.run(commands.cursorLineDown); },
  previousLine() { this.run(commands.cursorLineUp); },
  forwardChar() { this.run(commands.cursorCharRight); },
  backwardChar() { this.run(commands.cursorCharLeft); },
  forwardWord() { this.run(commands.cursorGroupForward); },
  backwardWord() { this.run(commands.cursorGroupBackward); },
  deleteChar() { this.run(commands.deleteCharForward); },
  deleteCharBack() { this.run(commands.deleteCharBackward); },
  deleteWord() { this.run(commands.deleteGroupForward); },
  backwardDeleteWord() { this.run(commands.deleteGroupBackward); },
  transposeChars() { this.run(commands.transposeChars); },
  selectAllText() { this.run(commands.selectAll); },

  async killLine() {
    const killed = commands.killLine(this.editorState);
    if (!killed) return;
    await navigator.clipboard.writeText(killed.text);
    this.dispatch(killed.spec);
  },

  async yank() {
    try {
      const text = await navigator.clipboard.readText();
      this.insertTextAtCursor(text);
    } catch (e) {
      console.warn("Failed to read clipboard:", e);
    }
  },

  async copyRegion() {
    const sel = this.selection;
    if (sel.empty) return;
    await navigator.clipboard.writeText(sliceString(this.doc, sel.from, sel.to));
  },

  async killRegion() {
    const sel = this.selection;
    if (sel.empty) return;
    await navigator.clipboard.writeText(sliceString(this.doc, sel.from, sel.to));
    this.dispatch({ changes: { from: sel.from, to: sel.to }, origin: "delete" });
  },

  setMark() {
    const head = this.selection.head;
    this._edMark = head;
    this.dispatch({ selection: { anchor: head }, origin: "command" });
  },

  cancel() {
    this._edMark = null;
    this.dispatch({ selection: { anchor: this.selection.head }, origin: "command" });
  },

  /**
   * @param {Selection} [sel]
   * @returns {string}
   */
  selectedText(sel) {
    const range = sel ?? this.selection;
    return sliceString(this.doc, range.from, range.to);
  },

  /** @param {{ changedProps: Map<string, unknown> }} detail */
  updated({ changedProps }) {
    if (!this._edState) return;
    if (changedProps.has("value") && changedProps.get("value") !== undefined) {
      const stored = this.$state.get("value");
      if (typeof stored === "string" && stored !== this.text) this.setText(stored);
    }
    if (changedProps.has("language") || changedProps.has("path")) this.setLanguage(this.language, this.path);
  },
}));
