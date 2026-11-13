/**
 * Which groups a theme holds, held by the type checker: `npm run typecheck`
 * fails when a line below stops meaning what it says.
 */

/** @import { ThemeData } from "../tokens.ts" */

/** @type {ThemeData} */
export const theme = {
  name: "fx-theme",
  canvas: { background: "#faf5f0" },
  text: { color: "#1a1a1a", muted: "#6b7280" },
  color: { primary: "#fabd2f" },
  lc: { button: { "border-radius": "0.75rem" } },
  dark: { canvas: { background: "#151813" }, color: { surface: "#1e221c" } },
};

/** @type {ThemeData} */
export const misspelled = {
  canvas: { background: "#faf5f0" },
  // @ts-expect-error a group the theme does not name is refused
  colour: { primary: "#fabd2f" },
};
