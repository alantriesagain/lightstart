/**
 * @file Probe AI: the theme's tokens natively. `variablesFor` flattens the
 * default preset's light and dark sides into their CSS variables, with the
 * derived shades and on-colors; `cssColorToHex` resolves the color forms a
 * compiled class can carry. Prints a dozen variables of each side and the
 * resolved colors, the same under node and natively.
 */
import { cssColorToHex, variablesFor } from "../../theme/tokens.ts";
import theme from "../../theme/themes/default.js";

const names = ["--color-primary", "--color-primary-light", "--color-on-primary", "--color-accent", "--color-surface", "--text-color", "--text-muted", "--canvas-background", "--border-color", "--spacing-md", "--font-bold", "--radius-md"];
for (const scheme of ["light", "dark"]) {
  const vars = variablesFor(theme, scheme);
  console.log(scheme + ": " + String(Object.keys(vars).length) + " variables");
  for (const name of names) console.log("  " + name + " = " + String(vars[name]));
}

for (const value of ["#fff", "#FFF8", "#101210", "#10121080", "rgb(16, 18, 16)", "rgba(255, 0, 0, 0.5)", "hsl(120 50% 50%)", "hsl(14 76% 54%)", "transparent", "var(--color-primary)"]) console.log(value + " -> " + String(cssColorToHex(value)));
