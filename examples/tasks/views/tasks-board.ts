/**
 * @file `<tasks-board .board=${board} .tasks=${tasks} empty="…" ?active>`:
 * one board as a bordered column titled by it, its tasks as `<task-row>`s
 * in a scroll box (or the empty text), and a slot under them for what the
 * app puts there. The active one draws its title bold. A row taking the
 * focus names the board with a `focus-board` event; an empty board is
 * focusable itself, so the arrows can land on it.
 */
import { View, define, html, key, nothing } from "@bootstrapp/light/native";
import "./task-row.ts";

import type { Board, Task } from "../models/types.ts";

export class TasksBoard extends View {
  board = this.prop<Board | null>("board", null);
  tasks = this.prop<Task[]>("tasks", []);
  empty = this.prop("empty", "");
  active = this.prop("active", false);

  override render(): unknown {
    const board = this.board.value;
    const tasks = this.tasks.value;
    return html`<div flex=1 border title=${board === null ? "" : String(board.title)} bold=${this.active.value} @focus=${() => this.$emit("focus-board", board)}>
      <div flex=1 scroll tabindex=${tasks.length === 0 ? "0" : nothing}>${tasks.length > 0 ? tasks.map((task) => key(String(task.id), html`<task-row .task=${task}></task-row>`)) : html`<p dim>${this.empty.value}</p>`}</div>
      <slot></slot>
    </div>`;
  }
}

define("tasks-board", () => new TasksBoard());
