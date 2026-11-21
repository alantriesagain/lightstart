import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppShellLayout extends View {
  render() {
    return html`<div class="shell"><header>Shell</header><app-container></app-container></div>`;
  }
}

View.register("app-shell-layout", AppShellLayout);
