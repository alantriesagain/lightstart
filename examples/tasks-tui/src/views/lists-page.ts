/**
 * @file `<lists-page>`, the `/lists` route: every list with its tasks counted, a click or Enter
 * on one opening it, and an editor that makes a new list.
 */
import { View, define, html, key, SubmitEvent, TInput } from "@lightstart/light/native/tui";
import { navigate } from "@lightstart/app/tui";
import lists from "../controllers/lists.ts";
import tasks from "../controllers/tasks.ts";

import type { KeyEvent } from "@lightstart/light/native/tui";

class ListsPage extends View {
  readonly input = new TInput("textarea");

  constructor() {
    super();
    this.box.flex = 1;
    this.input.placeholder = "a new list, Enter makes it";
  }

  private open(id: string): void {
    lists.select(id);
    navigate("/");
  }

  override render(): unknown {
    const current = lists.current.value;
    return html`<div class="flex-1" @submit=${(e: SubmitEvent) => lists.add(e.value)}>
      <div class="flex-1 overflow-y-auto">${lists.rows.value.map((row) => {
        const id = String(row.id);
        const count = tasks.countOf(id);
        return key(id, html`<p
          @click=${() => this.open(id)}
          @key=${(e: KeyEvent) => {
            if (e.key !== "enter") return;
            e.consume();
            this.open(id);
          }}
          class=${id === current ? "font-bold focus:underline" : "focus:font-bold"}
        >${String(row.name)} <span class="text-muted">${String(count.done)}/${String(count.all)} done</span></p>`);
      })}</div>
      ${this.input}
    </div>`;
  }
}

define("lists-page", ListsPage);
