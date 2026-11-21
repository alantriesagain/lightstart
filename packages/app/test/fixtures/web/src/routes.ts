export default {
  "/": { name: "home", title: "Home", view: "app-home" },
  "/about": { name: "about", title: "About", view: "app-about" },
  "/notes/:id": { name: "note", title: "Note", view: "app-about" },
  "/search": { name: "search", title: "Search", view: "app-search" },
  "/form": { name: "form", title: "Form", view: "app-form" },
  "/settings": {
    name: "settings",
    title: "Settings",
    view: "app-settings",
    routes: {
      "/profile": { name: "settings-profile", title: "Profile", view: "app-profile" },
      "/billing": { name: "settings-billing", title: "Billing", view: "app-billing" },
    },
  },
  "/plain": { name: "plain", title: "Plain", view: "app-plain", layout: null },
  "/item/:count": { name: "item", title: "Item", view: "app-item" },
  "/fixed/:count": { name: "fixed", title: "Fixed", view: "app-fixed", props: { label: "fixed", count: 5 } },
};
