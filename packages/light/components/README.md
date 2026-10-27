# light's components

131 web components in nine categories, with the mixins, libs and two stores they are built from. They are part of `@bootstrapp/light` and depend on nothing else: a component reads its host through light (`env`, `navigation`, `translate`, `trackWork`, `@bootstrapp/light/theme`).

```html
<lc-card>
  <lc-input label="Email" type="email" required></lc-input>
  <lc-button variant="primary" type="submit">Save</lc-button>
</lc-card>
```

## On a page of your own

A component module is a plain definition; `View.define` registers the tag. Every component declares `style: true` and keeps its stylesheet beside it, so import that too, after `theme/theme.css` (the base the tokens hang off). A component that `extends` another needs its base defined first; `lc-button` extends `lc-link`.

```js
import View from "@bootstrapp/light";
import { applyTheme } from "@bootstrapp/light/theme";
import { loadPreset } from "@bootstrapp/light/theme/presets.js";
import { configureIcons, iconify } from "@bootstrapp/light/theme/icons.js";
import link from "@bootstrapp/light/components/display/link.js";
import button from "@bootstrapp/light/components/display/button.js";
import icon from "@bootstrapp/light/components/display/icon.js";

applyTheme(await loadPreset("default"));
configureIcons({ load: iconify("lucide") });
for (const component of [link, button, icon]) View.define(component);
```

```css
@import "@bootstrapp/light/theme/theme.css";
@import "@bootstrapp/light/components/display/link.css";
@import "@bootstrapp/light/components/display/button.css";
@import "@bootstrapp/light/components/display/icon.css";
```

A browser resolves the bare specifiers through an importmap (`"@bootstrapp/light/": "/node_modules/@bootstrapp/light/"` covers every subpath); a bundler resolves them from `node_modules`.

`applyTheme` writes the design tokens the stylesheets read; `configureIcons` says where `<lc-icon>` fetches an icon (the public Iconify API here; a page that has the icons in its own stylesheet leaves it unset). Four more hooks matter only when you have the thing they connect: `configureNavigation` from `@bootstrapp/light/navigation` for a router (links are plain anchors without one), `configureView({ translate })` for translations (the components speak English without one), `configureMarkdown` from `display/markdown.js` for where `marked` comes from (the bare `marked` specifier by default), and `configureHighlight` from `utils/highlight.js` for a tokenizer behind `<lc-code-block>` (plain lines without one).

A component that draws other tags needs them defined too, or they stay inert; the table at the end lists what each one renders. `examples/starter` and `examples/indexeddb-explorer` are whole pages built this way.

## Inside a Bootstrapp app

Components load themselves. There is no import step and no registration call: the tag is the lookup key, and the framework's loader resolves `<lc-button>` to `components/display/button.js` through the `bootstrapp.components.lc` map in light's `package.json`, and the theme plugin brings the stylesheet along. Declare `@bootstrapp/light` in the project's `package.json` and write the tags. A production build inlines only the components a project's `bootstrapp.bundle.components` map lists, so an app ships what it renders and nothing else.

## The catalogue

`@bootstrapp/showcase` renders every component with its props, its examples and a skin picker: `cd projects/light && bootstrapp serve` from the monorepo, or `showcase://showcase` in the IDE.

| Category | Components |
|---|---|
| **form** (25) | auth-form, checkbox, color-picker, day-strip, file-upload, form, icon-picker, image-crop, input, join, label, month-picker, number-input, radio, radio-group, rating, ruler, search, segmented, select, slider, switch, textarea, time, week-hours |
| **display** (35) | avatar, avatar-group, badge, bar-chart, button, calendar, circle, code-block, comment, data-table, editable, example, flow, icon, image, kanban, kbd, line-chart, link, link-preview, list, list-item, list-row, markdown, media-card, palette, pattern, pie-chart, sparkline, stat, story-circle, table, tag, text, tile |
| **layout** (11) | card, container, divider, flex, grid, page, panel, prose, section, split-pane, toolbar |
| **navigation** (14) | accordion, breadcrumbs, menu, nav-item, nav-tree, navbar, pagination, sidebar, sidebar-section, tabs, toc, tree, tree-item, wizard |
| **overlay** (10) | alert-dialog, bottom-sheet, command-palette, context-menu, drawer, dropdown, float-panel, modal, popover, tooltip |
| **feedback** (8) | alert, empty-state, progress-bar, pull-indicator, skeleton, spinner, stepper, toast |
| **app shell** (9) | app-container, app-header, app-shell, bottom-nav, page-header, scroller, stories, swipe-deck, title-bar |
| **page sections** (14) | about-section, cta-section, faq-section, feature-grid, float-card, footer, hero-section, pricing-card, pricing-table, showcase-section, site-header, stats-section, steps-section, testimonial-section |
| **utility** (5) | clipboard, darkmode, device, draggable, droparea |

Every tag is `lc-` plus the name. The nine categories are declared in `@bootstrapp/showcase`'s `lib/categories.js`, whose test fails if a component directory here is not one of them. Three components that need a package of the monorepo live with that package under its prefix: `editor-code`, `editor-diff` (`@bootstrapp/editor`), `qr-code` (`@bootstrapp/qr`) and `anim-drag-panel` (`@bootstrapp/anim`).

Each component carries a `<component>.demo.js` beside it: the sentence that describes it, its worked examples, and the content the playground puts inside it. That file is what the catalogue draws, and the code under an example is the example's own source.

```js
import { html } from "@bootstrapp/light/html";

export default {
  description: "A clickable action. Colour attributes map to the theme's roles.",
  slot: () => "Click me",
  examples: [
    { title: "Variants", render: () => html`<lc-button primary>Primary</lc-button>` },
  ],
};
```

## Forms

`<lc-form>` takes a field list and draws it. A field says what it is and the component decides how: which control, how it serializes, whether it is even on screen.

```js
<lc-form
  .fields=${[
    { name: "title", label: "Title", type: "text", required: true },
    { name: "kind", label: "Kind", type: "select", options: ["bar", "beach"] },
    { name: "tls", label: "TLS", type: "checkbox" },
    { name: "cert", label: "Certificate", type: "text", visibleIf: "tls" },
    { name: "links", label: "Links", type: "array", itemFields: [{ name: "url", type: "url" }] },
  ]}
  .data=${row}
  @field-change=${(e) => save(e.detail.name, e.detail.value)}
  @form-submit=${(e) => write(e.detail)}
></lc-form>
```

| Option | What it does |
|---|---|
| `type` | Which control: any registered key, or a `cmsType` for a widget a package shipped. `cmsType: "week-hours"` draws `lc-week-hours` for an `array` of opening hours |
| `required` | Refused on submit, with the reason drawn beside the field |
| `help` / `description` | A hint under the control |
| `visibleIf` | A field name that has to be truthy, or a predicate over the values. A hidden field is not collected either |
| `min` / `max` / `step`, `disabled`, `readonly`, `placeholder`, `rows` | Forwarded to the control; on a `multi-select`, `max` is the most it takes |
| `searchable` | A `select` typed into to find its option. A `multi-select` always is, and draws what is picked as tags with an x |
| `prefix` | Text drawn inside a text field before what is typed and never part of the value, like the `@` of a handle |
| `options`, or `loadOptions` + `dependsOn` | A select's choices, constant or fetched and reloaded when what they follow changes; an option's `leading` (a flag, an emoji) is drawn before its label |
| `fields` / `itemFields` / `itemField` | An `object`'s shape, an `array`'s entry shape, or one plain value per entry |
| `class` | On the field's wrapper |

`layout="stacked"` gives each field its own row; the default pairs them two to a row above 640px.

A control it does not have is registered rather than worked around:

```js
import { registerFormFieldRenderer } from "@bootstrapp/light/components/form/field-renderers.js";

registerFormFieldRenderer("colour", (field, value, onChange, html) => html`
  <input type="color" .value=${value} @input=${(e) => onChange(e.target.value)} />
`);
```

The key is `field.cmsType` when there is one, else `field.type`, so registering under a built-in type replaces that control everywhere. A built-in control labels itself; a registered one draws only the control, and `<lc-form>` draws its label above it (`drawsOwnLabel` is the distinction). A view that draws its own chrome around a control asks `renderFormControl(field, value, onChange, html)` for one instead of dispatching on the type itself, which is what `check/field-list-through-form` holds it to.

The field list itself usually comes from a schema: `@bootstrapp/form` reads a model's `$form` block, a schema with none, or a variable spec, and answers one of these.

## The words the components draw

Components write text of their own: the pagination controls, the message a form shows on an empty required field, the chart and table empty states, the close labels on the modal and the toast, and the aria-labels a screen reader reads. `locales/<locale>.js` at light's root holds them keyed by tag, and `utils/text.js` resolves one with `lcText(tag, key, params)`.

```js
import { lcText } from "../utils/text.js";

html`<div class="chart-empty">${lcText("lc-chart", "noData")}</div>`
```

`bootstrapp.locales: true` in light's `package.json` is what makes a Bootstrapp app pick the files up: the manifest records which languages light ships, the runtime merges them beneath the project's own file, and a build merges every contribution into one file per language. A key the project defines wins. Without a translator `lcText` answers the English in `locales/en.js`, interpolation included, so that file is both the contribution and the default. A component outside light hands its own words in as the fourth argument.

A component that takes copy as a prop (`loadmoreText`, `confirmText`, `nextLabel`, the auth form's labels) defaults it to empty and falls through to the locale file. Set the prop and it wins: it is the caller's word for this one instance, the locale file is the language everywhere else.

Adding a string means adding it to **every** `locales/*.js`, not just `en.js`. `utils/text.test.js` fails on a key that is missing from one of them, and on a tag that names no component.

## Theming

Restyle through your project's `theme.js`, never by writing CSS around a component.

Nine shape tokens carry a whole look, so a restyle is usually a handful of lines rather than a block per component: `radius.field` for what a reader types into or presses, `radius.selector` for what they tick, `radius.box` for what things sit on, `shadow.field`, `shadow.box` and `shadow.focus`, `motion.lift` and `motion.press` for hover and press, and `control.weight`, `control.transform` and `control.tracking` for chrome type.

```js
export default {
  radius: { field: "0.75rem", selector: "0.375rem", box: "1rem" },
  shadow: { field: "4px 4px 0 0 #000", box: "6px 6px 0 0 #000" },
  motion: { lift: "-2px -2px", press: "2px 2px" },
  control: { weight: "900", transform: "uppercase" },
};
```

None of them has a default: a component reads the role between its own variable and its own fallback, so a theme that names none looks exactly as it did.

What one component alone should do goes in an `lc` block:

```js
export default {
  lc: {
    button: { "border-radius": "0.75rem", "primary-color": "#000000" },
  },
};
```

`lc.button["border-radius"]` becomes `--lc-button-border-radius`, which `display/button.css` consumes with a fallback. Anything a component does not expose as a variable is not meant to be themed; add the variable to the component rather than reaching around it. `theme/presets.js` lists the presets light ships, and the showcase can dress its stage in any of them.

## Composing your own components

Eight mixins carry behaviour that more than one component needs. List them under `mixins: []`:

| Mixin | What the host gets |
|---|---|
| `withFormControl` | label, name, value, disabled, required, size and variant props, an id for `<label for>`, and form association through ElementInternals |
| `withClickOutside()` | `onClickOutside(e)` whenever a click lands outside the host |
| `withEscapeKey` | `onEscape()` while mounted |
| `withOverlay()` | a place on the overlay stack while open: scroll lock, focus restore, and Escape delivered only to the topmost layer |
| `withPopover` | a layer anchored to whatever opened it, with `toggle(trigger)`, `_open(trigger)` and `_close()` |
| `withPointerDrag()` | a drag the host follows: `onDragStart`, `onDragMove` once per frame, `onDragEnd` |
| `withSwipeThreshold()` | `onSwipe(direction)` when a gesture clears a distance and beats the other axis |
| `withResize(method)` | the named method called on connect and whenever the host's box changes |

```js
import { defineComponent } from "@bootstrapp/light";
import { withFormControl } from "@bootstrapp/light/components/mixins/form-control.js";

export default defineComponent({
  mixins: [withFormControl],
  tag: "my-field",
  render() {
    const id = this.getInputId();
    return html`
      ${this.label ? html`<lc-label for=${id} text=${this.label}></lc-label>` : ""}
      <input id=${id} .value=${this.value} ?disabled=${this.disabled} />
    `;
  },
});
```

## Libs

Pure modules: no `$APP`, no DOM, each tested under `node --test`.

| Module | Exports |
|---|---|
| `utils/id.js` | `uniqueId(prefix)` for an element id a `<label for>` can point at |
| `utils/roving.js` | `nextIndex(key, current, length, opts)`, or null when the key moves nothing |
| `utils/breakpoints.js` | the breakpoint table and its media queries |
| `utils/scale.js` | `compactNumber(value)` for a tick label (`1.2K`), `niceMax(max, intervals)` for a round top of a value axis |
| `utils/time-ago.js` | `timeAgo(iso, locale, now)`, a timestamp as "2 hours ago" in the reader's language |
| `utils/highlight.js` | `highlightLines(code, language)`, plain lines until `configureHighlight({ lines })` hands a tokenizer in |
| `overlay/anchor.js` | `anchorPosition({ trigger, floating, side, align, offset, viewport })`, clamped into the viewport |
| `overlay/detents.js` | `resolveStops`, `classify`, `releaseVelocity`, `rubber` for a draggable sheet |
| `overlay/float-rect.js` | `clampRect`, `loadRect`, `saveRect` for a floating window |
| `form/search-match.js` | `matchDocs`, `groupDocs` |
| `form/path.js` | `parsePath`, `getPath`, `setPath`, `deletePath` over `links[0].url` |
| `form/field-renderers.js` | `renderFormControl`, `registerFormFieldRenderer`, `getFormFieldRenderer`, `formFieldTypes` |
| `utils/week-hours.js` | `expandWeek`, `groupWeek`, `weekOrder`, `isClock`, `pastMidnight`: a week of opening hours as `{ days, open, close }` entries, the form `lc-week-hours` writes |
| `form/crop-rect.js` | `coverRect`, `clampRect`, `panRect`, `zoomRectAt`, `rectAtZoom`, `pinchRect`, `wheelFactor`, `keyIntent` and the rest: the square of a picture `lc-image-crop` keeps, and how each gesture moves it |

`utils/long-press.js` is the exception: `attachLongPress(host)` touches the DOM and returns a teardown for `this.$own()`. `form/crop-canvas.js` is another: `loadPicture`, `cropToBlob` and `encodesWebp` decode and encode through a canvas, in a browser only.

## Stores

Two plain modules on light's signals, imported where they are used.

- **`toasts`** (`feedback/toasts.js`): the toast queue and its per-entry timers. `toasts.show({ title, message, variant, icon, duration, onTap })` returns an id; `hide(id)` cancels one; `success`, `error`, `warning` and `info` are shortcuts. An entry leaves after 3 s (an error after 5 s, `duration: 0` never); one shown with `onTap` is a button, and a tap takes it off and runs it. `<lc-toast>` renders `toasts.items`. `--lc-toast-top` and `--lc-toast-bottom` keep the stack clear of a status bar or a dock.
- **`overlays`** (`overlay/stack.js`): the stack every modal, drawer, sheet and popover joins while open, through `withOverlay`. It owns the scroll lock (released only when the last locking layer closes) and delivers Escape to the topmost layer that will take one.

## CSS: light DOM

Every component renders into light DOM, and a `<slot>` in its template projects the host's children there. A component's sibling `.css` file loads into the document, so:

- Every top-level selector is scoped: `:where(.lc-thing, lc-thing) { ... }`. `:where()` adds no specificity, so scoping an existing rule never changes what it beats.
- A part is named by its tag, `part="lc-thing-body"`, and selected as `& [part~=lc-thing-body]`. The prefix keeps a `body` in one component away from a `body` in another nested inside it.
- A slotted child is the slot element's child: `& slot > [slot="figure"]`.
- Expose what a consumer may restyle through a part and `--lc-*` variables.

`::part()`, `::slotted()` and `:host` match nothing in light DOM; `bootstrapp check` enforces all of this.

## Developing

Authoring rules, the citizen decisions behind the mixins and stores, and the conventions the checker enforces are in [AGENTS.md](./AGENTS.md). From the monorepo, `cd light && bootstrapp check && bootstrapp test`; from the light repo alone, `pnpm test`.

## What each component renders

A page without the framework defines these too, one level deep; follow the table until nothing is missing.

| Component | Renders |
|---|---|
| `lc-about-section` | `lc-markdown` |
| `lc-accordion` |  |
| `lc-alert` | `lc-icon` |
| `lc-alert-dialog` | `lc-button`, `lc-icon` |
| `lc-app-container` | `lc-app-header`, `lc-avatar`, `lc-bottom-nav`, `lc-breadcrumbs`, `lc-card`, `lc-contact-avatar`, `lc-device`, `lc-drawer`, `lc-flex`, `lc-grid`, `lc-icon`, `lc-metric-hero-card`, `lc-sidebar`, `lc-text`, `lc-title-bar`, `lc-tree` |
| `lc-app-header` | `lc-icon` |
| `lc-app-shell` | `lc-drawer`, `lc-icon`, `lc-navbar` |
| `lc-auth-form` | `lc-button`, `lc-input`, `lc-tabs` |
| `lc-avatar` | `lc-icon` |
| `lc-avatar-group` | `lc-avatar` |
| `lc-badge` | `lc-button` |
| `lc-bar-chart` |  |
| `lc-bottom-nav` | `lc-avatar`, `lc-badge`, `lc-icon`, `lc-nav-item` |
| `lc-bottom-sheet` |  |
| `lc-breadcrumbs` | `lc-icon`, `lc-link` |
| `lc-button` |  |
| `lc-calendar` |  |
| `lc-card` | `lc-button`, `lc-icon` |
| `lc-checkbox` | `lc-label` |
| `lc-circle` |  |
| `lc-clipboard` | `lc-button` |
| `lc-code-block` | `lc-button`, `lc-clipboard` |
| `lc-color-picker` | `lc-icon` |
| `lc-command-palette` | `lc-icon`, `lc-kbd`, `lc-modal`, `lc-search` |
| `lc-comment` | `lc-avatar`, `lc-badge`, `lc-button`, `lc-link` |
| `lc-container` |  |
| `lc-context-menu` | `lc-button`, `lc-icon`, `lc-menu` |
| `lc-cta-section` |  |
| `lc-darkmode` | `lc-icon`, `lc-nav-item`, `lc-switch` |
| `lc-data-table` | `lc-pagination`, `lc-select`, `lc-table` |
| `lc-day-strip` |  |
| `lc-device` | `lc-app-container`, `lc-app-header`, `lc-drawer`, `lc-icon`, `lc-link`, `lc-text` |
| `lc-divider` |  |
| `lc-draggable` |  |
| `lc-drawer` | `lc-button`, `lc-checkbox`, `lc-divider`, `lc-flex`, `lc-form`, `lc-icon`, `lc-input`, `lc-link`, `lc-sidebar`, `lc-text` |
| `lc-droparea` |  |
| `lc-dropdown` | `lc-button`, `lc-icon` |
| `lc-editable` | `lc-button`, `lc-input`, `lc-join` |
| `lc-empty-state` | `lc-button`, `lc-icon` |
| `lc-example` | `lc-button`, `lc-clipboard`, `lc-code-block`, `lc-segmented` |
| `lc-faq-section` | `lc-icon` |
| `lc-feature-grid` | `lc-icon` |
| `lc-file-upload` | `lc-button`, `lc-icon` |
| `lc-flex` | `lc-badge`, `lc-button`, `lc-input`, `lc-navbar`, `lc-sidebar` |
| `lc-float-card` |  |
| `lc-float-panel` |  |
| `lc-flow` |  |
| `lc-footer` | `lc-icon` |
| `lc-form` | `lc-label` |
| `lc-grid` | `lc-avatar`, `lc-button`, `lc-flex`, `lc-icon`, `lc-link`, `lc-panel` |
| `lc-hero-section` |  |
| `lc-icon` |  |
| `lc-icon-picker` | `lc-icon` |
| `lc-image` |  |
| `lc-image-crop` | `lc-icon`, `lc-slider`, `lc-spinner` |
| `lc-input` | `lc-button`, `lc-join`, `lc-label` |
| `lc-join` | `lc-button`, `lc-input`, `lc-search`, `lc-select` |
| `lc-kanban` | `lc-card`, `lc-draggable`, `lc-droparea`, `lc-icon` |
| `lc-kbd` |  |
| `lc-label` | `lc-input` |
| `lc-line-chart` |  |
| `lc-link` | `lc-icon`, `lc-tooltip` |
| `lc-link-preview` | `lc-card` |
| `lc-list` |  |
| `lc-list-item` |  |
| `lc-list-row` | `lc-badge`, `lc-button`, `lc-icon` |
| `lc-markdown` | `lc-code-block` |
| `lc-media-card` | `lc-badge` |
| `lc-menu` | `lc-button`, `lc-dropdown`, `lc-icon` |
| `lc-modal` | `lc-button` |
| `lc-month-picker` | `lc-icon` |
| `lc-nav-item` | `lc-icon`, `lc-tooltip` |
| `lc-nav-tree` | `lc-icon`, `lc-nav-item` |
| `lc-navbar` | `lc-avatar`, `lc-button`, `lc-dropdown`, `lc-icon`, `lc-input` |
| `lc-number-input` | `lc-icon` |
| `lc-page` |  |
| `lc-page-header` | `lc-breadcrumbs`, `lc-button` |
| `lc-pagination` | `lc-icon`, `lc-link` |
| `lc-palette` |  |
| `lc-panel` | `lc-button`, `lc-input`, `lc-switch` |
| `lc-pattern` |  |
| `lc-pie-chart` |  |
| `lc-popover` | `lc-button` |
| `lc-pricing-card` | `lc-icon` |
| `lc-pricing-table` | `lc-pricing-card` |
| `lc-progress-bar` |  |
| `lc-prose` |  |
| `lc-pull-indicator` | `lc-icon`, `lc-spinner` |
| `lc-radio` |  |
| `lc-radio-group` | `lc-radio` |
| `lc-rating` | `lc-icon` |
| `lc-ruler` |  |
| `lc-scroller` | `lc-icon` |
| `lc-search` | `lc-icon`, `lc-join` |
| `lc-section` | `lc-button`, `lc-icon`, `lc-panel` |
| `lc-segmented` | `lc-icon` |
| `lc-select` | `lc-icon`, `lc-label`, `lc-tag` |
| `lc-showcase-section` | `lc-markdown` |
| `lc-sidebar` | `lc-darkmode`, `lc-icon`, `lc-link`, `lc-menu` |
| `lc-sidebar-section` | `lc-badge`, `lc-icon` |
| `lc-site-header` |  |
| `lc-skeleton` |  |
| `lc-slider` |  |
| `lc-sparkline` |  |
| `lc-spinner` |  |
| `lc-split-pane` |  |
| `lc-stat` | `lc-icon`, `lc-join` |
| `lc-stats-section` | `lc-icon` |
| `lc-stepper` | `lc-icon`, `lc-spinner` |
| `lc-steps-section` | `lc-icon` |
| `lc-stories` | `lc-icon` |
| `lc-story-circle` | `lc-avatar`, `lc-icon` |
| `lc-swipe-deck` | `lc-icon` |
| `lc-switch` |  |
| `lc-table` | `lc-icon` |
| `lc-tabs` | `lc-icon` |
| `lc-tag` | `lc-icon` |
| `lc-testimonial-section` | `lc-icon` |
| `lc-text` |  |
| `lc-textarea` | `lc-label` |
| `lc-tile` | `lc-icon` |
| `lc-time` |  |
| `lc-title-bar` | `lc-icon` |
| `lc-toast` | `lc-icon` |
| `lc-toc` |  |
| `lc-toolbar` | `lc-button`, `lc-divider`, `lc-segmented` |
| `lc-tooltip` | `lc-button` |
| `lc-tree` | `lc-tree-item` |
| `lc-tree-item` | `lc-icon` |
| `lc-week-hours` | `lc-switch` |
| `lc-wizard` |  |
