import View from "@lightstart/light";
import T from "@lightstart/light/types";
import { html } from "@lightstart/light/html";

class AppItem extends View {
  static props = { count: T.number() };

  render() {
    return html`<p class="item">${String(this.count)} ${typeof this.count}</p>`;
  }
}

View.register("app-item", AppItem);
