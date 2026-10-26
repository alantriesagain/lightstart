---
name: restyle-theme
description: Restyle a project from references or a preset by writing its theme.js, then verify with screenshots
user_invocable: true
---

<!-- Managed by Bootstrapp: generated from @bootstrapp/theme/skills/restyle-theme.md. Edit the source, then run `bootstrapp types`. -->

# Restyle a project

All styling flows through `theme.js` (`package.json` `bootstrapp.theme: { path: "/theme.js", runtime: true }`). Presets are a starting point, never a constraint.

## From references (the usual case)

1. **Read the references before writing code** and write the visual system down in a few lines: the surfaces (two or three colours that carry the app), the one accent and what it marks, the type pairing (display face and body face), the card radius, the shadow softness, the nav shape, any texture. Decide which screens are light and which are dark.
2. **Express it as tokens** in `theme.js`, one name per concept: `canvas.background` for the page (plus `canvas.font-size`, `line-height`, `selection`, `backdrop`, `scrollbar-*` when the look needs them), `text.color`, `text.secondary`, `text.muted` for text, `border.color` and `border.width` for edges, and `color.*` for the palette only, with an `on-` companion for every colour (translucent ones too: `glass`, `scrim`). A role never goes in the palette, which is for colours the app names (primary, surface, danger). Then `font.family` and `font.heading` as strings plus `font.google`, the `text` scale, `radius`, `shadow`, `spacing` (add `safe-top`, `safe-bottom`, `header`, `nav` for a phone shell), `z`, `leading`. Keep every key the scaffold theme had; `bootstrapp theme:check` requires the contract.
3. **Drive the components** through the `lc:` block: `button` (radius, height, the `primary`/`secondary`/`glass`/`ghost` colours), `card`, `list-row`, `stat`, `number-input`, `bottom-nav`, `badge` (never set its `background`), `tag`, `segmented`, `switch`, `progress-bar`, `input`, `alert-dialog`. Variable names: `grep -oE "var\(--lc-<component>-[a-z-]+" light/packages/light/components/**/<component>.css`.
4. **Write the `dark:` block** as the reader's dark mode, and reuse it as a charcoal scope for immersive screens: `Theme.applyScopedDarkTheme("<tag>, <tag>", theme, "<id>")` in `frontend.js`. Inside that scope tokens flip (`ink` becomes light), so text over photos uses a colour that is the same in both, such as `on-scrim`.
5. **Fonts**: `font.google: ["Manrope", "Bebas Neue"]` in `theme.js` and the object form `{ "family": "...", "google": "..." }` for `family` and `heading` in `package.json`; a single-weight display face never gets `font-bold`.
6. **Then the layouts**: rework each screen's markup to the reference (hero blocks, overlapping stat strips with `-mt-8`, pill tags as `lc-badge`/`lc-tag`, photo cards as `lc-card padding="none"` with an absolute `<img>` and a `bg-scrim` overlay, the raised nav action as `[prominent]` on the centre anchor).
7. **Verify with screenshots** at 390x844 next to the references (Playwright against `bootstrapp serve`), in light and dark. Iterate on tokens, then on layout.

## From a preset

`bootstrapp theme:list`, then `bootstrapp theme:apply <preset> --force` and edit the copy. Built-ins live in `light/packages/light/theme/themes/`.

## Rules

- Never hardcode palette values in views; views consume tokens (`bg-ink`, `text-on-scrim`) or theme vars.
- Respect `bootstrapp.generator.styling`; tailwind projects keep class lists as static literals.
- `bootstrapp theme:check` after every edit; no comments in `theme.js` beyond the header JSDoc.
- Reference: `projects/bboxe/theme.js` (references-driven, with `lc:` and `dark:` blocks), `projects/gymfluencer/theme.js`, `light/packages/light/theme/themes/neobrutalist.js` (structure).
