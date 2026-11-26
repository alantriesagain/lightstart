import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppHome extends View {
  render() {
    return html`<h1>Push fixture</h1>`;
  }
}

View.register("app-home", AppHome);
