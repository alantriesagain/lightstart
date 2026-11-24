import { t } from "@lightstart/i18n";
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppHome extends View {
  render() {
    return html`<p class="home">${t("home.title")}</p>`;
  }
}

View.register("app-home", AppHome);
