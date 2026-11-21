import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppRoot extends View {
  render() {
    return html`<nav><a id="about" href="/about">About</a><a id="external" href="/docs" rel="external">Docs</a><a id="raw" href="/raw" data-no-router>Raw</a></nav><app-container></app-container>`;
  }
}

View.register("app-root", AppRoot);
