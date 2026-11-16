import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppLegal extends View {
  render() {
    return html`<p>Legal</p>`;
  }
}

View.register("app-legal", AppLegal);
