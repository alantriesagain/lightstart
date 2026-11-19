/**
 * @file The root view: the todo list in a scroll box, the editor under it, and the keys.
 * Outside the editor Esc brings the focus back to the editor; Ctrl+C quits.
 */
import { html, key, SubmitEvent, TInput, View } from "@lightstart/light/native/tui";
import todos from "../controllers/todos.ts";
import "./todo-row.ts";

import type { KeyEvent, Renderer } from "@lightstart/light/native/tui";

export default class AppRoot extends View {
  /** The editor under the list, placed by the template. */
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
    return html`<div class="flex-1 border" @submit=${(e: SubmitEvent) => todos.add(e.value)}>
      <p class="font-bold">__TITLE__</p>
      <p class="text-muted">${rows.length} todos</p>
      <div class="flex-1 overflow-y-auto">${rows.length > 0 ? rows.map((row) => key(row.id, html`<todo-row .todo=${row}></todo-row>`)) : html`<p class="text-muted">No todos yet: type one below and press Enter.</p>`}</div>
      ${this.input}
      <p class="text-muted">Enter adds, Space toggles, d removes, Esc returns to the editor, Ctrl+C quits.</p>
    </div>`;
  }

  onKey(renderer: Renderer, e: KeyEvent): boolean {
    const { focus } = renderer;
    if (focus instanceof TInput && focus.isConnected()) return false;
    if (e.key !== "escape") return false;
    this.focusEditor(renderer);
    return true;
  }
}
