/**
 * @file `<todo-row .todo=${todo}>`: one todo as a focusable line, muted and struck through
 * when done and bold while focused. A click or Enter/Space toggles it, `d` removes it.
 */
import { View, define, html } from "@lightstart/light/native/tui";
import todos from "../controllers/todos.ts";

import type { KeyEvent } from "@lightstart/light/native/tui";
import type { TodoRow } from "../../.light/models.ts";

class TodoRowView extends View {
  todo = this.prop<TodoRow | null>("todo", null);

  override render(): unknown {
    const todo = this.todo.value;
    if (todo === null) return null;
    const done = todo.done;
    return html`<p
      @click=${() => todos.toggle(todo)}
      @key=${(e: KeyEvent) => {
        if (!e.typed("d")) return;
        e.consume();
        todos.remove(todo);
      }}
      class=${done ? "text-muted line-through focus:font-bold" : "focus:font-bold"}
    >${done ? "[x]" : "[ ]"} ${todo.title}</p>`;
  }
}

define("todo-row", TodoRowView);
