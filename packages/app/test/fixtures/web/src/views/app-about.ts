import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppAbout extends View {
  static props = { id: "" };

  render() {
    return html`<p>About</p>${this.id === "" ? "" : html`<p class="id">${this.id}</p>`}`;
  }
}

View.register("app-about", AppAbout);
