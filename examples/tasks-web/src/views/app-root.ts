/**
 * @file The root view: the open list's name, the nav to the three pages, and `<app-outlet>`,
 * which draws the page the path answers (src/routes.ts).
 */
import View from "@lightstart/light";
import { html } from "@lightstart/light/html";
import { t } from "@lightstart/i18n";
import lists from "../controllers/lists.ts";
import "./tasks-page.ts";
import "./lists-page.ts";
import "./activity-page.ts";

class AppRoot extends View {
  render() {
    const open = lists.currentList();
    return html`
      <main class="page">
        <header class="bar">
          <lc-text tag="h1" size="2xl" weight="bold">${t("app.title")}</lc-text>
          <lc-text color="muted">${open !== null ? String(open.name) : ""}</lc-text>
          <lc-language-switcher></lc-language-switcher>
        </header>
        <nav class="tabs">
          <a href="/">${t("nav.tasks")}</a>
          <a href="/lists">${t("nav.lists")}</a>
          <a href="/activity">${t("nav.activity")}</a>
        </nav>
        <app-outlet></app-outlet>
      </main>
    `;
  }
}

View.register("app-root", AppRoot);
