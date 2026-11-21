import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppAbout extends View {
  render() {
    return html`<p data-morph>About these notes</p>`;
  }
}

View.register("app-about", AppAbout);
