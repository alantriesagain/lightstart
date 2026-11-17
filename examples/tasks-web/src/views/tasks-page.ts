/**
 * @file `<tasks-page>`, the `/` route: the open list's tasks, each toggled by its checkbox and
 * removed by its button, and a form adding one to the list.
 */
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { t } from "@lightstart/i18n";
import tasks from "../controllers/tasks.ts";

class TasksPage extends View {
  private add(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const field = form.querySelector("input");
    if (!(field instanceof HTMLInputElement)) return;
    const value = field.value;
    field.value = "";
    void tasks.add(value);
  }

  render() {
    const rows = tasks.open();
    return html`
      <lc-card padding="lg">
        <form class="add" @submit=${(event: Event) => this.add(event)}>
          <input name="task" aria-label=${t("tasks.field")} placeholder=${t("tasks.field")} />
          <lc-button variant="primary" type="submit">${t("tasks.add")}</lc-button>
        </form>
        ${rows.length === 0
          ? html`<p class="muted">${t("tasks.empty")}</p>`
          : html`<ul class="tasks">
              ${rows.map(
                (row) => html`<li class=${row.done === true ? "done" : ""}>
                  <label><input type="checkbox" .checked=${row.done === true} @change=${() => tasks.toggle(row)} /> ${String(row.title)}</label>
                  <lc-button variant="secondary" size="sm" @click=${() => tasks.remove(row)}>${t("tasks.remove")}</lc-button>
                </li>`,
              )}
            </ul>`}
      </lc-card>
    `;
  }
}

View.register("tasks-page", TasksPage);
