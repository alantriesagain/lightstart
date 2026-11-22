import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { pwa } from "@lightstart/pwa/page";

globalThis.__pwa = pwa;

class AppHome extends View {
  render() {
    return html`<h1>Home</h1><a href="/about">About</a>`;
  }
}

View.register("app-home", AppHome);
