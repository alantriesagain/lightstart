/**
 * @file The site's pages. The shell's `<app-outlet>` draws the one the path answers, its path's
 * parameters (`category`, `name`, `topic`) set on the page as props.
 */
export default {
  "/": { name: "home", title: "Light", view: "docs-home" },
  "/components": { name: "components", title: "Components", view: "docs-overview" },
  "/components/:category": { name: "category", title: "Components", view: "docs-category" },
  "/components/:category/:name": { name: "component", title: "Components", view: "docs-component" },
  "/built-with-light": { name: "built-with-light", title: "Built with Light", view: "docs-built-with-light" },
  "/theming": { name: "theming", title: "Theming", view: "docs-theming" },
  "/skins": { name: "skins", title: "Skins", view: "docs-skins" },
  "/native": { name: "native", title: "Native", view: "docs-native" },
  "/native/comparison": { name: "native-comparison", title: "Native", view: "docs-native-comparison" },
  "/native/:topic": { name: "native-topic", title: "Native", view: "docs-native-topic" },
};
