import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppRoot extends View {
  render() {
    return html`<app-container></app-container>`;
  }
}

View.register("app-root", AppRoot);
