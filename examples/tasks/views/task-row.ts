/**
 * @file `<task-row .task=${task}>`: one task as a focusable line, a done one
 * muted and struck through by its classes, bold while it has the focus. Space
 * or a click toggles it, `d` removes it, Shift+Left and Shift+Right move it
 * to the neighbour board, each a call on the board controller.
 */
import { KeyEvent, View, define, html } from "@bootstrapp/light/native/tui";
import board from "../controllers/board.js";

import type { Task } from "../models/types.ts";

export class TaskRow extends View {
  task = this.prop<Task | null>("task", null);

  override render(): unknown {
    const task = this.task.value;
    if (task === null) return null;
    return html`<p
      @click=${() => board.toggle(task.id, task.done)}
      @key=${(e: KeyEvent) => {
        if (e.shift && (e.key === "left" || e.key === "right")) {
          e.consume();
          board.moveTask(task.id, e.key === "left" ? -1 : 1);
          return;
        }
        if (!e.typed("d")) return;
        e.consume();
        board.remove(task.id);
      }}
      class=${task.done ? "text-muted line-through focus:font-bold" : "focus:font-bold"}
    >${task.done ? "[x]" : "[ ]"} ${task.title}</p>`;
  }
}

define("task-row", TaskRow);
