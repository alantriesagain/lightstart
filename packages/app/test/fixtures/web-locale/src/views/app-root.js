import { t } from "@lightstart/i18n";
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppRoot extends View {
  render() {
    return html`
      <main>
        <h1>Fixture locale</h1>
        <nav><a id="home" href="/">${t("route.home")}</a> <a id="about" href="/about">${t("nav.about")}</a> <a id="spanish" href="/es/about">ES</a></nav>
        <app-container></app-container>
      </main>
    `;
  }
}

View.register("app-root", AppRoot);
