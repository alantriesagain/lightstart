import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppFixed extends View {
  static props = { label: "", count: 0 };

  render() {
    return html`<p class="fixed">${this.label}:${String(this.count)}</p>`;
  }
}

View.register("app-fixed", AppFixed);
