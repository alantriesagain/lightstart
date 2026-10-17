/**
 * @file The task app on the terminal: the list of `<task-row>`s under the
 * board's filter, the editor that adds a task, and the footer with the
 * counts and the keys. A row asks for its toggle or removal with an event
 * the app hands to the board. Outside the editor the arrows move the
 * focus, `f` cycles the filter and `c` clears the done tasks: `appKey`
 * takes those before any element sees them, so they work with nothing
 * focused too.
 */
import { CustomEvent, KeyEvent, Renderer, SubmitEvent, TInput, View, html, key } from "@bootstrapp/light/native";
import board from "../controllers/board.js";
import "./task-row.ts";

import type { Task } from "../models/types.ts";

const typed = (e: KeyEvent, text: string) => e.key === "char" && e.text === text && !e.ctrl && !e.alt;

/** The app's keys outside the editor; answers whether it took the key. */
export const appKey = (renderer: Renderer, e: KeyEvent): boolean => {
  const { focus } = renderer;
  if (focus instanceof TInput && focus.isConnected()) return false;
  if (e.key === "up" || e.key === "down") renderer.moveFocus(e.key === "up" ? -1 : 1);
  else if (typed(e, "f")) board.nextFilter();
  else if (typed(e, "c")) board.clearDone();
  else return false;
  return true;
};

const taskOf = (e: CustomEvent) => e.detail as Task;

export class TaskApp extends View {
  constructor() {
    super();
    this.box.flex = 1;
  }

  override render(): unknown {
    const { rows, filter, open, done } = board;
    const empty = filter === "all" ? "No tasks yet: type one below and press Enter." : `No ${filter} tasks.`;
    return html`<div flex=1 border title=${`tasks: ${filter}`}>
      <div flex=1 scroll>${rows.length > 0 ? rows.map((task) => key(String(task.id), html`<task-row .task=${task} @toggle=${(e: CustomEvent) => board.toggle(taskOf(e).id, taskOf(e).done)} @remove=${(e: CustomEvent) => board.remove(taskOf(e).id)}></task-row>`)) : html`<p dim>${empty}</p>`}</div>
      <textarea autofocus placeholder="a new task, Enter adds it" @submit=${(e: SubmitEvent) => board.add(e.value)}></textarea>
      <p dim>${open} open, ${done} done. Tab moves, Space toggles, d deletes, f filters, c clears done, Ctrl+C quits.</p>
    </div>`;
  }
}
