/**
 * @file `<todo-row .todo=${todo}>`: one todo as a focusable line, muted and struck through by its
 * classes when done and bold while focused. A click or Enter/Space toggles it, `d` removes it, each
 * a call on the todo controller.
 */
import { define, html, View } from "@lightstart/light/native/tui";
import { todos } from "../controllers/todos.ts";

import type { KeyEvent } from "@lightstart/light/native/tui";
import type { Todo } from "../models/todos.ts";

export class TodoRow extends View {
  todo = this.prop<Todo | null>("todo", null);

  override render(): unknown {
    const todo = this.todo.value;
    if (todo === null) return null;
    const done = todo.done === true;
    return html`<p
      @click=${() => todos.toggle(todo)}
      @key=${(e: KeyEvent) => {
        if (!e.typed("d")) return;
        e.consume();
        todos.remove(todo);
      }}
      class=${done ? "text-muted line-through focus:font-bold" : "focus:font-bold"}
    >${done ? "[x]" : "[ ]"} ${String(todo.title)}</p>`;
  }
}

define("todo-row", TodoRow);
