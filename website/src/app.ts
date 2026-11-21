/**
 * @file The site of light: every component with its examples and its props, in any skin, and the
 * pages on light native. A web app on `@lightstart/app`; its root view is the shell (the header,
 * the component tree, the search palette) around `<app-container>`. Nothing is stored: the skin a
 * reader picks is kept in localStorage by the catalogue controller.
 */
import { defineApp } from "@lightstart/app";

export default defineApp({
  name: "light-website",
  url: "https://lightstart.dev",
  host: "web",
  root: "template-shell",
  args: {
    skin: { description: "The skin the site renders in" },
  },
  stores: {
    main: { adapter: "memory" },
  },
});
