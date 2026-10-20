/**
 * @file `<tasks-board .board=${board} .tasks=${tasks} empty="…" ?active>`:
 * one board as a bordered column, its title a line of its own at the top,
 * its tasks as `<task-row>`s in a scroll box (or the empty text), and a slot
 * under them for what the app puts there. The active one's title is bold in
 * the primary color, the others' muted, through their classes; a class on
 * the column itself would reach every row, as on a page, which is what the
 * column's `focus-within:` tint does while the focus is inside it. A row
 * taking the focus makes the board the controller's focused one; an empty
 * board is focusable itself, so the arrows can land on it.
 */
import { View, define, html, key, nothing } from "@bootstrapp/light/native";
import board from "../controllers/board.js";
import "./task-row.ts";

import type { Board, Task } from "../models/types.ts";

export class TasksBoard extends View {
  board = this.prop<Board | null>("board", null);
  tasks = this.prop<Task[]>("tasks", []);
  empty = this.prop("empty", "");
  active = this.prop("active", false);

  override render(): unknown {
    const shown = this.board.value;
    const tasks = this.tasks.value;
    return html`<div class="flex-1 border focus-within:bg-surface" @focus=${() => {
      if (shown !== null) board.focusBoard(shown.id);
    }}>
      <p class=${this.active.value ? "font-bold text-primary" : "text-muted"}>${shown === null ? "" : shown.title}</p>
      <div class="flex-1 overflow-y-auto" tabindex=${tasks.length === 0 ? "0" : nothing}>${tasks.length > 0 ? tasks.map((task) => key(task.id, html`<task-row .task=${task}></task-row>`)) : html`<p class="text-muted">${this.empty.value}</p>`}</div>
      <slot></slot>
    </div>`;
  }
}

define("tasks-board", TasksBoard);
