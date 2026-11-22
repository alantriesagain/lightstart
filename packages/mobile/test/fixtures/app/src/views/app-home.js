import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppHome extends View {
  render() {
    return html`<h1>Home</h1><a href="/about">About</a>`;
  }
}

View.register("app-home", AppHome);
