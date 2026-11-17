/**
 * @file `<lists-page>`, the `/lists` route: every list with its tasks counted, a click opening
 * one, and a form making a new list.
 */
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { navigate } from "@lightstart/app/web";
import lists from "../controllers/lists.ts";
import tasks from "../controllers/tasks.ts";

class ListsPage extends View {
  private open(id: string): void {
    lists.select(id);
    navigate("/");
  }

  private add(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const field = form.querySelector("input");
    if (!(field instanceof HTMLInputElement)) return;
    const value = field.value.trim();
    field.value = "";
    if (value.length > 0) void lists.add(value);
  }

  render() {
    const current = lists.current.value;
    return html`
      <lc-card padding="lg">
        <ul class="lists">
          ${lists.rows.value.map((row) => {
            const id = String(row.id);
            const count = tasks.countOf(id);
            return html`<li class=${id === current ? "current" : ""}>
              <lc-button variant="secondary" size="sm" @click=${() => this.open(id)}>${String(row.name)}</lc-button>
              <span class="muted">${String(count.done)}/${String(count.all)} done</span>
            </li>`;
          })}
        </ul>
        <form class="add" @submit=${(event: Event) => this.add(event)}>
          <input name="list" aria-label="A new list" placeholder="A new list" />
          <lc-button type="submit">Make list</lc-button>
        </form>
      </lc-card>
    `;
  }
}

View.register("lists-page", ListsPage);
