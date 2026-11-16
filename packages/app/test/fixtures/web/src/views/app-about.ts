import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppAbout extends View {
  render() {
    return html`<p>About</p>`;
  }
}

View.register("app-about", AppAbout);
