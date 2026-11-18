/**
 * @file The site of light: every component with its examples and its props, in any skin, and the
 * pages on light native. A web app on `@lightstart/app`; its root view is the shell (the header,
 * the component tree, the search palette) around `<app-outlet>`. Nothing is stored: the skin a
 * reader picks is kept in localStorage by the catalogue controller.
 */
import View from "@lightstart/light";
import { syncPlugin } from "@lightstart/light/controller/view";
import { defineApp } from "@lightstart/app";

// The views' props declared with `sync:` follow the catalogue controller; installed before any view is defined.
View.use(syncPlugin);

export default defineApp({
  name: "light-website",
  host: "web",
  root: "template-shell",
  stores: {
    main: { kind: "memory" },
  },
});
