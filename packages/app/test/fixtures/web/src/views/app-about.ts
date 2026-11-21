import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppAbout extends View {
  static props = { id: "" };

  render() {
      return html`<h1 data-morph>About</h1><p>About</p><h2 id="more">More</h2>${this.id === "" ? "" : html`<p class="id">${this.id}</p>`}`;
  }
}

View.register("app-about", AppAbout);
