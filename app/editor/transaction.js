/**
 * Transactions: a state is `{ doc, selection }`; applying a spec answers the
 * new state plus everything a view or a history needs to know about it.
 */

/** @import { EditorState, Selection, TransactionSpec, Transaction } from "./types.js" */
import { applyChanges, createDoc, mapSelection, selection } from "./document.js";

/**
 * @param {import("./types.js").Doc} doc
 * @param {{ anchor: number, head?: number }} sel
 * @returns {Selection}
 */
export const clampSelection = (doc, sel) => {
  const clamp = (/** @type {number} */ p) => Math.min(Math.max(0, p), doc.length);
  return selection(clamp(sel.anchor), clamp(sel.head ?? sel.anchor));
};

/**
 * @param {string} [text]
 * @param {{ anchor: number, head?: number }} [sel]
 * @returns {EditorState}
 */
export const createState = (text = "", sel = { anchor: 0 }) => {
  const doc = createDoc(text);
  return { doc, selection: clampSelection(doc, sel) };
};

/**
 * @param {EditorState} state
 * @param {TransactionSpec} spec
 * @returns {Transaction}
 */
export const applyTransaction = (state, spec) => {
  const applied = spec.changes ? applyChanges(state.doc, spec.changes) : { doc: state.doc, changes: [], inverted: [] };
  const docChanged = applied.changes.length > 0;
  const nextSelection = spec.selection
    ? clampSelection(applied.doc, spec.selection)
    : docChanged
      ? mapSelection(applied.changes, state.selection)
      : state.selection;
  const selectionSet =
    nextSelection.anchor !== state.selection.anchor || nextSelection.head !== state.selection.head;
  return {
    state: { doc: applied.doc, selection: nextSelection },
    startState: state,
    changes: applied.changes,
    inverted: applied.inverted,
    docChanged,
    selectionSet,
    origin: spec.origin ?? "api",
    scrollIntoView: spec.scrollIntoView === true ? { y: "nearest" } : spec.scrollIntoView || false,
    addToHistory: spec.addToHistory ?? true,
  };
};
