/**
 * @file The task app on the terminal: the list under the board's filter, the
 * editor that adds a task, and the footer with the counts and the keys. A
 * task is focusable: Space or a click toggles it, `d` deletes it. Outside
 * the editor the arrows move the focus, `f` cycles the filter and `c` clears
 * the done tasks: `appKey` takes those before any element sees them, so they
 * work with nothing focused too.
 */
import { TInput, View, html, key } from "@bootstrapp/light/native";
import board from "../controllers/board.js";

/** @import { KeyEvent, Renderer, SubmitEvent } from "@bootstrapp/light/native" */

/** @param {KeyEvent} e @param {string} text */
const typed = (e, text) => e.key === "char" && e.text === text && !e.ctrl && !e.alt;

/** @param {{ id?: string | number, title?: string, done?: boolean }} task */
const taskRow = (task) => html`<p
  @click=${() => board.toggle(task.id, task.done)}
  @key=${(/** @type {KeyEvent} */ e) => {
    if (!typed(e, "d")) return;
    e.consume();
    board.remove(task.id);
  }}
  dim=${Boolean(task.done)}
>${task.done ? "[x]" : "[ ]"} ${task.title}</p>`;

/**
 * The app's keys outside the editor; answers whether it took the key.
 * @param {Renderer} renderer
 * @param {KeyEvent} e
 * @returns {boolean}
 */
export const appKey = (renderer, e) => {
  const { focus } = renderer;
  if (focus instanceof TInput && focus.isConnected()) return false;
  if (e.key === "up" || e.key === "down") renderer.moveFocus(e.key === "up" ? -1 : 1);
  else if (typed(e, "f")) board.nextFilter();
  else if (typed(e, "c")) board.clearDone();
  else return false;
  return true;
};

export class TaskApp extends View {
  constructor() {
    super();
    this.box.flex = 1;
  }

  render() {
    const { rows, filter, open, done } = board;
    const empty = filter === "all" ? "No tasks yet: type one below and press Enter." : `No ${filter} tasks.`;
    return html`<div flex=1 border title=${`tasks: ${filter}`}>
      <div flex=1 scroll>${rows.length > 0 ? rows.map((task) => key(String(task.id), taskRow(task))) : html`<p dim>${empty}</p>`}</div>
      <textarea autofocus placeholder="a new task, Enter adds it" @submit=${(/** @type {SubmitEvent} */ e) => board.add(e.value)}></textarea>
      <p dim>${open} open, ${done} done. Tab moves, Space toggles, d deletes, f filters, c clears done, Ctrl+C quits.</p>
    </div>`;
  }
}
