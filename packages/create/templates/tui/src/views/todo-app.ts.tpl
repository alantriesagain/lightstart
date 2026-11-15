/**
 * @file The app on the terminal: the list in a scroll box, the editor under it, and a footer with
 * the filter, the counts and the keys. Outside the editor `f` cycles the filter, `c` clears the
 * done todos and Esc brings the focus back to the editor.
 */
import { html, key, nothing, SubmitEvent, TInput, View } from "@lightstart/light/native/tui";
import { todos } from "../controllers/todos.ts";
import "./todo-row.ts";

import type { KeyEvent, Renderer } from "@lightstart/light/native/tui";

export class TodoApp extends View {
  /** The editor above the footer, placed by the template. */
  readonly input = new TInput("textarea");

  constructor() {
    super();
    this.box.flex = 1;
    this.input.placeholder = "a todo, Enter adds it";
    this.input.attrs.set("autofocus", "");
  }

  /** Give the focus back to the editor. */
  focusEditor(renderer: Renderer): void {
    renderer.setFocus(this.input);
  }

  override render(): unknown {
    const rows = todos.rows.value;
    let open = 0;
    for (const todo of todos.all.value) if (todo.done !== true) open++;
    const done = todos.all.value.length - open;
    const filter = todos.filter.value;
    const empty = filter === "all" ? "No todos yet: type one below and press Enter." : `No ${filter} todos.`;
    return html`<div class="flex-1 border" @submit=${(e: SubmitEvent) => todos.add(e.value)}>
      <p class="font-bold">__TITLE__</p>
      <p class="text-muted">${String(open)} open, ${String(done)} done</p>
      <div class="flex-1 overflow-y-auto" tabindex=${rows.length === 0 ? "0" : nothing}>${rows.length > 0 ? rows.map((todo) => key(String(todo.id), html`<todo-row .todo=${todo}></todo-row>`)) : html`<p class="text-muted">${empty}</p>`}</div>
      ${this.input}
      <p class="text-muted">filter: ${filter}. Tab moves, f filters, c clears done, Esc returns to the editor, Ctrl+C quits.</p>
    </div>`;
  }
}

/** The app's keys outside the editor; answers whether it took the key. */
export const appKey = (renderer: Renderer, app: TodoApp, e: KeyEvent): boolean => {
  const { focus } = renderer;
  if (focus instanceof TInput && focus.isConnected()) return false;
  if (e.key === "escape") app.focusEditor(renderer);
  else if (e.typed("f")) todos.nextFilter();
  else if (e.typed("c")) todos.clearDone();
  else return false;
  return true;
};
