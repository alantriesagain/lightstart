/**
 * @file `<task-row .task=${task}>`: one task as a focusable line, muted and struck through when
 * done, bold while focused. A click or Space toggles it, `d` removes it.
 */
import { View, define, html } from "@lightstart/light/native/tui";
import tasks from "../controllers/tasks.ts";

import type { KeyEvent } from "@lightstart/light/native/tui";
import type { Task } from "../models/task.ts";

class TaskRow extends View {
  task = this.prop<Task | null>("task", null);

  override render(): unknown {
    const task = this.task.value;
    if (task === null) return null;
    const done = task.done === true;
    return html`<p
      @click=${() => tasks.toggle(task)}
      @key=${(e: KeyEvent) => {
        if (!e.typed("d")) return;
        e.consume();
        void tasks.remove(task);
      }}
      class=${done ? "text-muted line-through focus:font-bold" : "focus:font-bold"}
    >${done ? "[x]" : "[ ]"} ${String(task.title)}</p>`;
  }
}

define("task-row", TaskRow);
