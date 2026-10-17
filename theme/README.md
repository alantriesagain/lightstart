# @bootstrapp/light/theme

A theme is a plain object of tokens; this module turns it into the CSS custom
properties every component reads.

```javascript
import { applyTheme } from "@bootstrapp/light/theme";
import { loadPreset } from "@bootstrapp/light/theme/presets.js";

applyTheme(await loadPreset("neobrutalist"));
applyTheme({ color: { primary: "#fabd2f" }, radius: { field: "0.75rem" } });
```

`theme.css` is the base stylesheet the tokens hang off (resets, the canvas,
selection, scrollbars); link it once. `presets.js` lists the themes in
`themes/`, in the order a picker offers them.

## Entries

| Import | Holds |
|---|---|
| `@bootstrapp/light/theme` | the API below: a theme applied to a document, a region or a stylesheet string, the color math, the presets |
| `@bootstrapp/light/theme/tokens` | the host-neutral half: the color math, `generateThemeVariables`, `variablesFor(theme, scheme)`, `cssColorToHex`; nothing of a document, so a terminal reads the same tokens |
| `@bootstrapp/light/theme/classes` | the utility classes a theme gives: `createEngine`, `buildTheme`, the rule table (see Classes) |
| `@bootstrapp/light/theme/palette` | the opt-in Tailwind palette, reached by a dynamic import |
| `@bootstrapp/light/theme/runtime` | the browser host of the classes: `createRuntime(engine, { doc, raf, preflight })` |

## API Reference

| Function | What it does |
|---|---|
| `applyTheme(themeData)` | Apply an object: variables, variant rules, the dark side, the fonts |
| `applyScopedTheme(selector, theme, styleId?)` | The same palette on one region instead of the document |
| `applyScopedDarkTheme(selector, theme, styleId?)` | Its dark side on one region, derived the same way |
| `clearScopedTheme(selector, styleId?)` | Drop a scoped palette again |
| `generateThemeVariables(theme)` | The flattened `--group-key` map a theme generates |
| `generateShades(hsl, config?)` | lighter, light, dark and darker from one colour |
| `googleFontsUrl(families)` | The stylesheet URL for one or more Google families |
| `parseColor(string)` | HEX, RGB or HSL into HSL |
| `themeCSS(theme, overrides?)` | The whole theme as one stylesheet string, for a build |
| `configureTheme({ requestFont })` | How a font a theme names is fetched; Google Fonts by default |

A colour a theme names gets four shades and a readable `--color-on-<name>` for
free, and every palette colour becomes a `lc-button[variant="<name>"]` rule.

## Theme Structure

```javascript
export default {
  name: "my-theme",
  canvas: { background: "#faf5f0", "font-size": "16px" },
  font: { family: "Manrope", heading: "Manrope", google: ["Manrope"], normal: "400", bold: "700" },
  text: { color: "#1a1a1a", secondary: "#4b5563", muted: "#6b7280", sm: "0.875rem", base: "1rem" },
  color: { primary: "#fabd2f", surface: "#ffffff", danger: "#ef4444" },
  spacing: { xs: "0.25rem", md: "0.75rem", xl: "1.5rem" },
  radius: { sm: "0.25rem", md: "0.375rem", lg: "0.5rem", full: "9999px" },
  shadow: { sm: "0 1px 3px rgb(0 0 0 / 0.1)", md: "0 4px 6px rgb(0 0 0 / 0.1)" },
  border: { width: "1px", color: "#e5e7eb" },
  dark: { canvas: { background: "#151813" }, color: { surface: "#1e221c" } },
  lc: { button: { "border-radius": "0.75rem" } },
};
```

Every group flattens to `--group-key` (`color.primary` becomes `--color-primary`,
`lc.button["border-radius"]` becomes `--lc-button-border-radius`). A `dark`
block lands on `:root.dark`; what it leaves out is derived from the light side.

Every preset here covers the tokens the components read without a fallback, which
`packages/theme/themes.test.js` enforces in the Bootstrapp repo.

## One name per concept

Each thing a theme colours has one group, and the group is the thing being
painted: `text.*` for text, `border.*` for edges, `canvas.*` for the page.
The `color` group is the palette (primary, surface, danger, ...): every key in
it also gets four shades, an `on-` contrast colour and a button variant, which
is right for a palette colour and wrong for a role.

| Group | Keys | Variables |
|---|---|---|
| `text` | `color`, `secondary`, `muted`, `disabled` | `--text-color`, `--text-secondary`, `--text-muted`, `--text-disabled` |
| `font` | `family`, `heading`, `google`, `icon`, and the weight steps `thin` to `black` | `--font-family-base`, `--font-heading`, `--font-<step>`: the body reads `--font-normal`, the component stylesheets and the `font-<step>` utilities read each step |
| `border` | `color`, `width` | `--border-color`, `--border-width` |
| `canvas` | `background`, `font-size`, `line-height`, `selection`, `selection-text`, `backdrop`, `scrollbar-width`, `scrollbar-thumb`, `scrollbar-track` | `--canvas-*` |

`canvas.background` is required. The rest are optional: `theme.css` reads each
with today's default as its fallback (`font-size` 16px, scaled ×1.125 under
768px and ×1.25 under 480px; `line-height` 1.2; the selection tinted from the
primary colour; a `rgba(0,0,0,.8)` dialog backdrop; a thin grey scrollbar).

## Shape tokens

Nine optional roles decide how the whole library is shaped, so a look that is
not the default is a page of theme rather than a `lc.*` block per component.
None has a default: a component reads the role between its own variable and its
own fallback, so nothing changes until a theme names one.

| Token | Reaches |
|---|---|
| `radius.field` | button, input, select, textarea, number-input, search |
| `radius.selector` | checkbox, badge, tag |
| `radius.box` | card, container, panel, modal, dropdown, popover, tooltip, alert, toast, table |
| `shadow.field` | button, input, select, textarea, checkbox |
| `shadow.box` | card, modal, drawer, dropdown, popover, panel, toast |
| `shadow.focus` | every focus ring |
| `motion.lift` / `motion.press` | button and card on hover and on press, as one `translate` pair |
| `control.weight` / `control.transform` / `control.tracking` | button, tabs, label, badge, tag, pagination, segmented, breadcrumbs |

```javascript
radius: { field: "0.75rem", selector: "0.375rem", box: "1rem" },
shadow: { field: "4px 4px 0 0 #000", box: "6px 6px 0 0 #000", focus: "6px 6px 0 0 #000" },
motion: { lift: "-2px -2px", press: "2px 2px" },
control: { weight: "900", transform: "uppercase", tracking: "0.05em" },
```

That is most of what separates `themes/neobrutalist.js` from `themes/daisy.js`.

## Classes

Every token is also a utility class. `theme/classes/` is an atomic-CSS engine with Tailwind's grammar: a class such as `flex`, `p-4`, `text-primary` or `hover:bg-muted` compiles to a rule whose declarations point at the theme's variables (`color: var(--color-primary)`), never at the values, so a `:root.dark` reassignment flows through untouched. One implementation serves a page's dev runtime and a build, so the two cannot drift.

```js
import { createEngine, buildTheme } from "@bootstrapp/light/theme/classes";
import theme from "@bootstrapp/light/theme/themes/default.js";

const engine = createEngine({ theme: buildTheme(theme) });
const { css, matched, unknown } = engine.generate(["flex", "bg-surface", "hover:text-primary"]);
engine.compile("p-4"); // { cls, selector, medias, weight, decls: ["padding:1rem"], order, important }
```

`buildTheme(theme, { palette })` turns the theme's groups into the utility scales: `color.*` and `text.*` become color utilities (`color.ink` gives `text-ink`, `bg-ink`, `border-ink`), `shadow.*` `shadow-<k>`, `radius.*` `rounded-<k>`, `spacing.*` named spacing, `leading.*` and `font.*` likewise; a declared color earns an `on-<k>` companion (`text-on-hero` reads `--color-on-hero`, the readable contrast color the tokens derive). The raw Tailwind palette (`text-gray-400`) is opt-in through `palette`, loaded from `@bootstrapp/light/theme/palette`. `createEngine({ theme, safelist })` compiles the safelist with whatever classes it is given, for class names composed at run time that a build cannot see. `engine.generate(classes)` answers the stylesheet and the classes it did not know; the browser runtime (`@bootstrapp/light/theme/runtime`) compiles classes as a `MutationObserver` sees them appear and rewrites one `<style data-tw-runtime>` once per frame. A Bootstrapp app gets both from `@bootstrapp/theme`, which boots the runtime in development and compiles `style.css` in a build.

Deliberate divergences from Tailwind's preset: `dark:` targets `:root.dark`, the class `colorScheme` flips, so the variables and the variant can never disagree; breakpoints are px; transforms are individual properties (`translate:`, `rotate:`, `scale:`); filters do not compose; shadows and rings are plain `box-shadow`, last wins; `space-*` and `divide-*` use the child combinator; font weights read the theme (`font-bold` is `font-weight: var(--font-bold, 700)`); the palette is Tailwind v3 hex; opacity is fractional and a `/modifier` alpha compiles to `color-mix(in srgb, …)`, the one alpha form that works on `var()` tokens; the no-hyphen shorthands (`p1`, `w2`) are rejected. Left unbuilt until a project needs them: shadow colors, `ring-offset-*`, keyframes beyond the four stock animations, container queries, `before:`/`after:` content injection, `theme()` inside arbitrary values. Anything parked shows up in `generate`'s `unknown` list instead of silently missing.

## Presets

| Preset | Look |
|---|---|
| `default` | Ink and one signal colour on cool grey, hairline edges, the platform's type |
| `neobrutalist` | Thick black borders, hard offset shadows, uppercase controls |
| `daisy` | Pill selectors, a soft depth under buttons, base surfaces in three steps |
| `gruvbox-dark` / `gruvbox-light` | Warm retro groove palette |

## License

AGPL-3.0
