# light/website (projects/light in the monorepo)

The component catalogue: the app that renders every `@bootstrapp/light` component from
its own demo, in any skin. It depends on `@bootstrapp/light` and `@bootstrapp/theme` the
way every project does, so the palette, the Google font and the icon collection arrive
through the ordinary boot with nothing set up by hand.

## Where things come from

- The nine categories and their order: `@bootstrapp/showcase/lib/categories.js`.
- A component's page is drawn from two things and nothing else: its `props` block
  and the `<component>.demo.js` beside it in the package. `@bootstrapp/showcase/lib/demos.js`
  loads one; the snippet under an example is `render.toString()`.
- The skins: `@bootstrapp/theme/presets.js`. A skin dresses the stages only, through
  `applyScopedTheme`; the chrome keeps this project's `theme.js`.
- The route table is `routes.js`: `/` (the landing page, `views/home.js`, its words and
  snippets in `lib/home-content.js` and its live `my-counter` in `lib/home-demos.js`),
  `/components`, `/components/:category`, `/components/:category/:name`, `/theming`,
  `/skins`, `/native`, `/native/comparison`, `/native/:topic`, every one inside the `template-shell` template, which
  drops the rail and the outline on the landing page. The router spreads `category`, `name`
  and `topic` onto the page as props.
- `/native` (`views/native.js`) introduces the section and lists its pages in two groups,
  light's native build and the background, as `lib/native/pages.js` orders them (the nav
  column inside the section, the pager, the palette; `nav` is a shorter label where the full
  one does not fit). `/native/comparison` (`views/native-comparison.js`) follows one program,
  `native-examples/counter.ts`, through a browser, Node and scriptc in an `lc-flow`, with its
  words in `lib/native/overview.js`. Every other page is `/native/:topic`
  (`views/native-topic.js`), drawn from `lib/native/topics.js`: one `topic-<topic>.js`
  module of sections and blocks each. `lib/native/links.test.js` holds every internal link
  to a page and section that exist.
- Every snippet and number comes from a generated module that `scripts/capture-native.mjs`
  writes from the real tools: `captures.js` (the overview's examples), `captures-types.js`
  (`--types`: `native-examples/types/`), `captures-pairs.js` (`--pairs`: the slow and fast
  versions in `native-examples/fast/`, timed alternately) and `measures.js` (`--measures`:
  light itself; `TSGO=<TypeScript 7's tsc>` and `SCRIPTC_REPO=<a scriptc checkout>`). Run
  with `SCRIPTC=<scriptc>`; never edit the outputs by hand. Sentences that depend on a run
  (V8's tiers, which change helps which engine) are computed from them, and each types
  example lists the facts its text states, which the capture checks: a scriptc release that
  changes one fails the capture instead of leaving the page wrong. Capture on an idle
  machine; each capture records its load average and the pages print it.
- `controllers/catalogue.js` keeps what the pages share: the chosen skin (persisted, and
  taken from `?skin=` on boot), the search, the presets with their swatches, the current
  page's outline, and `open`/`select` for a card or a palette pick.
- `views/templates/shell.js` is the site around a page: `lc-app-shell` with the header
  (brand, the site's links, `lc-command-palette`, the skin `lc-dropdown`, `lc-darkmode`),
  a `lc-nav-tree` from the categories in the nav column (a drawer on a phone), and a
  `lc-toc` in the aside when the page reports headings.
- `lib/paths.js` spells the URLs and walks the catalogue in order; `lib/search-index.js`
  builds what the palette searches. Both are pure and tested under node.

## Rules for this project

- The site is composed from light's components. A raw `<pre>`, `<table>`, `<kbd>`, `<details>`
  or `<dialog>` in a view here means light is missing a component, and the fix is in
  light, not in this project's markup (`uix/pages-through-components`, this project's own rule in
  `check/rules/`, which shares its scan with `@bootstrapp/showcase`'s `pages-through-components`).
- Every length is a `--spacing-*`, `--radius-*` or `--text-*` token; the only literal
  pixel values allowed in this project's CSS are `0`, `1px`, `2px`, a media query's width
  and the `--docs-*` declarations in the shell (`tests/css-scale.test.js`).
- Views scope every top-level selector as `:where(docs-x)`; the shell's `.docs-page`,
  `.docs-title`, `.docs-lede` and `.docs-pager` are the classes a page's header uses.

## Writing the native pages

The /native pages explain engines and compilers to developers who know JavaScript and
TypeScript well but have not looked inside either. Write for peers:

- Headings name the topic in a plain noun phrase, in sentence case: "Bytecode",
  "Deoptimization", "Data layout", "Reference counting". No slogans, no wordplay, no
  parallel phrases ("one engine, two hosts"), no colon-and-punchline titles.
- Use the real terms (type feedback, deoptimization, tagged union) and define each one in
  plain words the first time it appears. No metaphors in their place: no roads, bets,
  guesses or notes.
- A section says what happens, shows the captured output, points at the lines that matter
  and says what follows for speed or behavior. It stops there: no closing moral, no "in
  short", no "X, not Y" contrast for effect.
- No evaluative words ("very good", "the price of", "real limits") and no instructions to
  the reader ("pick a step"). A number always says what was measured and how.
- The runtime is Node in prose and `node` in a command; the native build is "native
  (scriptc)" where it stands beside the browser and Node.

## Commands

```bash
bootstrapp serve                 # http://localhost:3530
bootstrapp check                 # zero findings
bootstrapp typecheck
bootstrapp test                  # node + browser (tests/app-*.browser.test.js boot the real app)
```
