import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import notes from "../controllers/notes.js";

class AppHome extends View {
  render() {
    const rows = notes.rows.value;
    return html`<lc-card><lc-text>Home</lc-text><ul>${rows.map((row) => html`<li>${String(row.text)}</li>`)}</ul></lc-card><div class="tall" style="height: 2500px"></div>`;
  }
}

View.register("app-home", AppHome);
