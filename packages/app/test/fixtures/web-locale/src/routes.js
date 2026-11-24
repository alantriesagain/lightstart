import { t } from "@lightstart/i18n";

export default {
  "/": { name: "home", title: () => t("route.home"), view: "app-home" },
  "/about": { name: "about", title: () => t("route.about"), view: "app-about" },
};
