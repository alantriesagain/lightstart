---
name: build-app
description: The ordered path from a fresh scaffold to an app that passes every gate
user_invocable: true
---

<!-- Managed by Bootstrapp: generated from @bootstrapp/generator/skills/build-app.md. Edit the source, then run `bootstrapp types`. -->

# Build the app

The order below keeps every step verifiable before the next one starts. Run every command from the project directory.

1. **Design first.** Pick references (Dribbble or the user's own) and write the visual system down before any code: surfaces, one accent, type pairing, radii, shadows, nav shape. Express it in `theme.js` and its `lc:` block (`/restyle-theme`).
2. **Data.** `models/schema.js` for every model; reference data as pure code in `lib/` with a node test, seeded through `models/seed.js` with `bootstrapp.build.seed: true` and a production guard for demo rows (`/add-model`, `/add-seed-data`). `bootstrapp types`.
3. **Pure libs.** Every rule that can be a function of its inputs lives in `lib/*.js` with `lib/*.test.js`; `bootstrapp test --node` green before any controller exists.
4. **Controllers** in dependency order, each with its `tests/app-<name>.browser.test.js` in the same step (`/add-controller`); `bootstrapp test` green.
5. **Routes and views**: `routes.js`, the shell template, then one view per screen composing light's components (`/add-route`, `/add-view`); `bootstrapp check` at zero.
6. **Screenshots** at phone size (390x844) of every screen next to the references; fix layout and tokens until they read the same.
7. **E2e**: `tests/e2e/*.e2e.js` journeys through the built app; `bootstrapp build --spa && bootstrapp test --e2e`.
8. **Gates**: `bootstrapp check`, `bootstrapp theme:check`, `bootstrapp test`, `bootstrapp typecheck`, and from the repo root `npm run lint:fix`, all clean.
9. **Docs**: rewrite the project's `AGENTS.md` for what it became; log every stumble in `FRICTION.md` as it happens (`/friction-log`).

## Gotchas that cost the most last time

- A view method named `remove`, `append`, `click`, `focus` or `blur` is refused at define time; pick another name.
- A full-screen `flex flex-col` needs `shrink-0` on fixed-height blocks or a long list collapses them.
- Seeds load once per database: bump `bootstrapp.database.version` after editing reference data.
- Playwright cannot see a dialog host: wait with `{ state: "attached" }`.
