import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppRoot extends View {
  render() {
    return html`
      <main>
        <h1>Notes</h1>
        <nav><a href="/">Home</a> <a href="/about" data-morph-source>About</a></nav>
        <app-container></app-container>
      </main>
    `;
  }
}

View.register("app-root", AppRoot);
