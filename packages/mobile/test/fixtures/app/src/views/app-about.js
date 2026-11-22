import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppAbout extends View {
  render() {
    return html`<h1>About</h1><a href="/">Home</a>`;
  }
}

View.register("app-about", AppAbout);
