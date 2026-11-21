import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppPlain extends View {
  render() {
    return html`<p>Plain</p>`;
  }
}

View.register("app-plain", AppPlain);
