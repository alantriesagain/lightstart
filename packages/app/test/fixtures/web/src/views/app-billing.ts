import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppBilling extends View {
  render() {
    return html`<p>Billing</p>`;
  }
}

View.register("app-billing", AppBilling);
