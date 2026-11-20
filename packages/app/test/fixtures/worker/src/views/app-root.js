import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppRoot extends View {
  render() {
    return html`
      <main>
        <h1>Worker fixture</h1>
        <app-container></app-container>
      </main>
    `;
  }
}

View.register("app-root", AppRoot);
