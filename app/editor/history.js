/**
 * Undo history over transactions. Consecutive typing within `newGroupDelay`
 * at an adjacent position joins one event; undo and redo answer the change
 * sets to apply in order plus the selection to restore.
 */

/** @import { History, HistoryEvent, HistoryMove, Transaction, EditorState, NormalizedChange } from "./types.js" */

const JOINABLE = new Set(["input", "delete", "composition"]);

/**
 * @param {{ newGroupDelay?: number, minDepth?: number }} [options]
 * @returns {History}
 */
export const createHistory = ({ newGroupDelay = 500, minDepth = 100 } = {}) => ({
  done: [],
  undone: [],
  newGroupDelay,
  minDepth,
});

/**
 * @param {NormalizedChange[]} last
 * @param {NormalizedChange[]} next
 * @returns {boolean}
 */
const adjacent = (last, next) => {
  if (last.length !== 1 || next.length !== 1) return false;
  const a = last[0];
  const b = next[0];
  const end = a.from + a.insert.length;
  return b.from === end || b.to === a.from || (b.to === end && b.to > b.from && a.insert.length > 0);
};

/**
 * @param {History} history
 * @param {Transaction} tr
 * @param {number} [time]
 * @returns {History}
 */
export const record = (history, tr, time = Date.now()) => {
  if (!tr.docChanged || !tr.addToHistory || tr.origin === "history") return history;
  const step = { changes: tr.changes, inverted: tr.inverted };
  const last = history.done[history.done.length - 1];
  const joins =
    last &&
    JOINABLE.has(tr.origin) &&
    last.origin === tr.origin &&
    time - last.time <= history.newGroupDelay &&
    adjacent(last.steps[last.steps.length - 1].changes, tr.changes);
  const done = joins
    ? [
        ...history.done.slice(0, -1),
        { ...last, steps: [...last.steps, step], selectionAfter: tr.state.selection, time },
      ]
    : [
        ...history.done,
        {
          steps: [step],
          selectionBefore: tr.startState.selection,
          selectionAfter: tr.state.selection,
          time,
          origin: tr.origin,
        },
      ];
  return { ...history, done: done.slice(-history.minDepth), undone: [] };
};

/**
 * @param {History} history
 * @returns {HistoryMove | null}
 */
export const undo = (history) => {
  const event = history.done[history.done.length - 1];
  if (!event) return null;
  return {
    history: { ...history, done: history.done.slice(0, -1), undone: [...history.undone, event] },
    changes: event.steps.map((s) => s.inverted).reverse(),
    selection: event.selectionBefore,
  };
};

/**
 * @param {History} history
 * @returns {HistoryMove | null}
 */
export const redo = (history) => {
  const event = history.undone[history.undone.length - 1];
  if (!event) return null;
  return {
    history: { ...history, undone: history.undone.slice(0, -1), done: [...history.done, event] },
    changes: event.steps.map((s) => s.changes),
    selection: event.selectionAfter,
  };
};

/**
 * Close the current group so the next recorded transaction starts a new event.
 * @param {History} history
 * @returns {History}
 */
export const closeGroup = (history) => {
  const last = history.done[history.done.length - 1];
  if (!last) return history;
  return { ...history, done: [...history.done.slice(0, -1), { ...last, time: -Infinity }] };
};

/**
 * @param {EditorState} state
 * @returns {EditorState}
 */
export const identity = (state) => state;

/** @type {(event: HistoryEvent) => number} */
export const stepCount = (event) => event.steps.length;
