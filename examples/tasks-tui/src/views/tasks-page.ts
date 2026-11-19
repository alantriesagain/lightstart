/**
 * @file `<tasks-page>`, the `/` route: the open list's tasks and the editor under them, Enter
 * adding what it holds to the list.
 */
import { View, define, html, key, SubmitEvent, TInput } from "@lightstart/light/native/tui";
import tasks from "../controllers/tasks.ts";
import "./task-row.ts";

class TasksPage extends View {
  readonly input = new TInput("textarea");

  constructor() {
    super();
    this.box.flex = 1;
    this.input.placeholder = "a task, Enter adds it";
    this.input.attrs.set("autofocus", "");
  }

  override render(): unknown {
    const rows = tasks.open();
    return html`<div class="flex-1" @submit=${(e: SubmitEvent) => tasks.add(e.value)}>
      <p class="text-muted">${rows.length} tasks</p>
      <div class="flex-1 overflow-y-auto">${rows.length > 0 ? rows.map((row) => key(row.id, html`<task-row .task=${row}></task-row>`)) : html`<p class="text-muted">No tasks here yet: type one below and press Enter.</p>`}</div>
      ${this.input}
    </div>`;
  }
}

define("tasks-page", TasksPage);
