import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppAbout extends View {
  render() {
    return html`<p>About</p><a id="home" href="/">Home</a>`;
  }
}

View.register("app-about", AppAbout);
