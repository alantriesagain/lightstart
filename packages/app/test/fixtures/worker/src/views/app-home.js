import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import archive from "../controllers/archive.js";

class AppHome extends View {
  render() {
    const rows = archive.rows.value;
    return html`<ul>${rows.map((row) => html`<li>${String(row.text)}</li>`)}</ul>`;
  }
}

View.register("app-home", AppHome);
