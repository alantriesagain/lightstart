import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { signal } from "@lightstart/light/signals";

class AppRoot extends View {
  count = signal(0);

  render() {
    return html`
      <main class="page">
        <lc-text tag="h1" size="2xl" weight="bold">__TITLE__</lc-text>
        <lc-card padding="lg">
          <p>This page is a light view with lc-* components.</p>
          <lc-button variant="primary" @click=${() => this.count.value++}>
            Count: ${this.count.value}
          </lc-button>
        </lc-card>
      </main>
    `;
  }
}

View.register("app-root", AppRoot);
