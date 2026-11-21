import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppHome extends View {
  render() {
    return html`<p>Home</p>`;
  }
}

View.register("app-home", AppHome);
