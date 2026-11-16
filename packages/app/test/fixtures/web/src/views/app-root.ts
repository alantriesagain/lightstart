import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import notes from "../controllers/notes.ts";

class AppRoot extends View {
  render() {
    const rows = notes.rows.value;
    return html`
      <main>
        <h1>Notes</h1>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
        </nav>
        <button @click=${() => notes.add(`note ${String(rows.length + 1)}`)}>Add note</button>
        <ul>
          ${rows.map((row) => html`<li>${String(row.text)}</li>`)}
        </ul>
        <app-outlet></app-outlet>
      </main>
    `;
  }
}

View.register("app-root", AppRoot);
