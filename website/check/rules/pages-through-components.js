import { defineRule } from "@lightstart/light/check";
import { reportRawBlocks } from "@lightstart/showcase/check/rules/pages-through-components.js";

export default defineRule({
  severity: "error",
  description: "the site's pages are composed from lc components, never from a raw block lc has a component for",
  why: "this project is the library's showcase: a raw <pre>, <table>, <kbd>, <details> or <dialog> in one of its views is a component lc should have had, drawn by hand instead, and every hand-drawn block is one more thing a theme cannot reach. The fix is in the package, a new component or an extended one, not in this project's markup",
  check(ctx) {
    reportRawBlocks(ctx, (file) => file.startsWith("src/views/"));
  },
});
