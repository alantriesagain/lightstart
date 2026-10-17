/**
 * @file `<task-row .task=${task}>`: one task as a focusable line. Space or a
 * click asks to toggle it and `d` to remove it, as `toggle` and `remove`
 * events carrying the task, which the app handles.
 */
import { KeyEvent, View, define, html } from "@bootstrapp/light/native";

import type { Task } from "../models/types.ts";

const typed = (e: KeyEvent, text: string) => e.key === "char" && e.text === text && !e.ctrl && !e.alt;

export class TaskRow extends View {
  task = this.prop<Task | null>("task", null);

  override render(): unknown {
    const task = this.task.value;
    if (task === null) return null;
    return html`<p
      @click=${() => this.$emit("toggle", task)}
      @key=${(e: KeyEvent) => {
        if (!typed(e, "d")) return;
        e.consume();
        this.$emit("remove", task);
      }}
      dim=${Boolean(task.done)}
    >${task.done ? "[x]" : "[ ]"} ${task.title}</p>`;
  }
}

define("task-row", () => new TaskRow());
