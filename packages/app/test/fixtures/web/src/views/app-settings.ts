import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppSettings extends View {
  render() {
    return html`<h1>Settings</h1><nav><a href="/settings/profile">Profile</a><a href="/settings/billing">Billing</a></nav><app-container></app-container>`;
  }
}

View.register("app-settings", AppSettings);
