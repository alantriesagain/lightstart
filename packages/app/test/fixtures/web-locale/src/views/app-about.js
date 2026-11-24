import { pageHead } from "@lightstart/app";
import { t } from "@lightstart/i18n";
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";

class AppAbout extends View {
  render() {
    pageHead({ jsonLd: { "@context": "https://schema.org", "@type": "AboutPage", name: t("route.about") } });
    return html`<p class="about">${t("about.text")}</p>`;
  }
}

View.register("app-about", AppAbout);
