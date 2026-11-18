// node-only
import { readFile } from "node:fs/promises";
import { assert, done, same, test } from "./check.ts";
import { themeVariables } from "../lib/theme-vars.ts";
import type { ThemeVariable } from "../lib/theme-vars.ts";

test("a variable is listed once, with the role it falls back to", () => {
  const css = `
    :where(lc-x) {
      border-radius: var(--lc-x-border-radius, var(--radius-field, var(--radius-md, 0.375rem)));
      color: var(--lc-x-color, var(--text-color));
      padding: var(--lc-x-padding, 1rem);
      &:hover { border-radius: var(--lc-x-border-radius, 0); }
    }`;
  const expected: ThemeVariable[] = [
    { name: "--lc-x-border-radius", fallback: "--radius-field", role: true },
    { name: "--lc-x-color", fallback: "--text-color", role: false },
    { name: "--lc-x-padding", fallback: "1rem", role: false },
  ];
  same(themeVariables(css, "lc-x"), expected);
});

test("another component's variables are not this one's", () => {
  const css = "color: var(--lc-other-color, red); background: var(--lc-x-background);";
  const expected: ThemeVariable[] = [{ name: "--lc-x-background", fallback: null, role: false }];
  same(themeVariables(css, "lc-x"), expected);
});

const buttonCSS = await readFile(new URL("../node_modules/@lightstart/components/display/button.css", import.meta.url), "utf-8");

test("the button's own stylesheet exposes its radius and shadow through roles", () => {
  const rows = themeVariables(buttonCSS, "lc-button");
  const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
  assert.equal(byName["--lc-button-border-radius"]?.fallback, "--radius-field");
  assert.equal(byName["--lc-button-shadow"]?.fallback, "--shadow-field");
  assert.equal(byName["--lc-button-focus-shadow"], undefined, "button does not read a focus-shadow variable");
  assert.ok(rows[0].role, "role-backed variables sort first");
});

done();
