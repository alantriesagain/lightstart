import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppHome extends View {
  render() {
    return html`<p>Home</p><a class="morph-link" href="/about">About</a>`;
  }
}

View.register("app-home", AppHome);
