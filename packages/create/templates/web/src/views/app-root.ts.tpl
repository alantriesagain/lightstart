import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import button from "@lightstart/components/display/button.js";
import link from "@lightstart/components/display/link.js";
import text from "@lightstart/components/display/text.js";
import card from "@lightstart/components/layout/card.js";
import notes from "../controllers/notes.ts";

for (const component of [link, button, text, card]) View.define(component);

class AppRoot extends View {
  private add(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const field = form.querySelector("input");
    if (!(field instanceof HTMLInputElement)) return;
    const value = field.value.trim();
    if (value.length === 0) return;
    field.value = "";
    void notes.add(value);
  }

  render() {
    const rows = notes.rows.value;
    return html`
      <main class="page">
        <lc-text tag="h1" size="2xl" weight="bold">__TITLE__</lc-text>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
        </nav>
        <lc-card padding="lg">
          <form class="add" @submit=${(event: Event) => this.add(event)}>
            <input name="note" aria-label="A note" placeholder="A note" />
            <lc-button variant="primary" type="submit">Add note</lc-button>
          </form>
          <ul>
            ${rows.map((row) => html`<li>${String(row.text)}</li>`)}
          </ul>
        </lc-card>
        <app-outlet></app-outlet>
      </main>
    `;
  }
}

View.register("app-root", AppRoot);
