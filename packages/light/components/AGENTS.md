# light's components

129 components, eight mixins, twelve libs, two stores, under `components/` in the light package. Consumer docs are
in [README.md](./README.md); this file is what to know before editing them.

## Adding a component

Two things must agree, and a rule fails the package if they do not: the entry in
`bootstrapp.components.lc` in light's `package.json`, and the `tag:` the definition declares. The loader
takes the tag from the map, so a definition without one still registers and renders, and that is
the trap: every rule guarded on "is this a component" answers no, and the file goes unchecked.
Ten components sat that way until 2026-09-10.

Always `defineComponent({...})` as the direct default export. Assigning it to a name and exporting
the name below works at runtime and used to hide the file from the checker; the parser follows an
identifier now, but the direct form is the convention.

`style: true` needs a sibling `.css`, and a `.css` beside a component needs `style: true`.

A new component belongs to one of the nine categories in `@bootstrapp/showcase`'s
`lib/categories.js`, which is what the catalogue and the IDE sidebar navigate by; its
`categories.test.js` fails on a component directory that is not a category.

## CSS

A sibling `.css` loads into the document. Every component renders into light DOM, and a
`<slot>` in its template projects the host's children there.

**Colour goes through one name per concept.** Text reads `--text-color`, `--text-secondary` and
`--text-muted`, edges `--border-color`, the page `--canvas-background`, and everything else the palette
(`--color-primary`, `--color-surface-dark`, ...). Read a colour with no fallback and it has to exist:
`packages/theme/themes.test.js` fails a bare read the default preset does not define, because such a
declaration is dropped and the component renders without it.

**A component variable is named for the CSS property it sets**, spelled as CSS spells it:
`--lc-<component>-background`, `-border-color`, `-border-radius`, `-color`, `-font-weight`. One
concept keeps one name across the library, so a theme that knows the property knows the variable.
A bare `-border` carries a whole shorthand (`--lc-avatar-border: 2px solid #d1d5db`).

**Shape goes through a role, not a literal.** Radius, shadow, hover motion and control weight
read `var(--lc-<c>-<x>, var(--<role>, var(--<scale>, <literal>)))`: `--radius-field`,
`--radius-selector`, `--radius-box`, `--shadow-field`, `--shadow-box`, `--shadow-focus`,
`--motion-lift`, `--motion-press`, `--control-weight`, `--control-transform`,
`--control-tracking`. No role is defined anywhere by default, so the component's own fallback
is what renders until a theme names one; that is what lets a skin restyle the whole library in
a dozen lines instead of a `lc.*` block each.

Two traps worth knowing before adding a component, both of which the sweep had to fix. A
variable composed **on the element** (`--lc-button-shadow: <size> <color>`) can never be set
from `:root`, so a theme key pointing at it is dead. And `transform: translate(...) scale(...)`
cannot be driven by one token, while the individual `translate:` and `scale:` properties
compose natively.

- Scope every top-level selector as `:where(.lc-thing, lc-thing) …`. `:where()` contributes
  no specificity, so adding the prefix to an existing rule cannot change what it beats.
- A part is named by its tag, `part="lc-thing-body"`, and selected as
  `& [part~=lc-thing-body]`; a slotted child is the slot element's child,
  `& slot > [slot="figure"]`. `::part()`, `::slotted()` and `:host` match nothing.
- Expose what a consumer may restyle through a part and `--lc-*` variables. Everything else
  is internal.

Two specificity traps when merging blocks: an attribute **inside** the parentheses
(`:where(.lc-x[variant="a"], lc-x[variant="a"])`) weighs nothing, but the same attribute nested
as `&[variant="a"]` weighs a class, and a rule written as `.lc-x [part~=lc-x-y]` rather than
`:where(...)` is deliberately heavier. `layout/card.css` and `app/bottom-nav.css` both carry
comments saying so.

## Mixins

**Two hosts or it is not a mixin.** One host means it is that component's own code.

| Mixin | Hosts |
|---|---|
| `withFormControl` | every form control |
| `withClickOutside()` | select, dropdown, search, popover |
| `withEscapeKey` | overlays, and the IDE's task selection |
| `withOverlay()` | modal, drawer, sheet, dropdown, stories |
| `withPopover` | dropdown, popover, icon-picker |
| `withPointerDrag()` | divider, split-pane, float-panel (capture); drag-panel, bottom-sheet (`capture: false, touchFallback: true`); `withPullToRefresh` (also `mouse: false`, and `dragYields` handing every move but a pull back to the page's scroll) |
| `withPullToRefresh()` | an app's own scrolling page, which draws `lc-pull-indicator` above its content |
| `withSwipeThreshold()` | drawer, stories |
| `withResize()` | asset-wave, asset-waveform (`@bootstrapp/assets`) |

A fragment that takes options is a function returning `defineMixin({...})`; one that does not is
the object itself. Do not annotate a mixin method with `@this`: `defineMixin` already types `this`
from the fragment's own `props` and everything else as `any`, and an annotation replaces that,
losing the properties.

## Libs

Pure: no `$APP`, no DOM, testable under `node --test`. Geometry and index arithmetic qualify;
anything that attaches a listener does not. `utils/long-press.js` is the one exception in `utils/`,
and it is shaped as `attach*(host) => teardown` for `this.$own()` rather than pretending to be pure.

Extracting a positioner or a scheduler: split it. The math is a lib, the subscription that keeps it
current stays in the mixin (`overlay/anchor.js` against `mixins/popover.js`).

## The form

`form/form.js` is the engine and `form/field-renderers.js` is the table of controls, keyed by
`field.cmsType` when there is one and `field.type` otherwise. A new control is a registration, never
a branch added to the engine: `renderField` looks one up, and a view that wants a control with its
own chrome around it calls `renderFormControl` rather than dispatching on the type itself.
`check/field-list-through-form` fires on a file that dispatches on four or more field types while
drawing two or more controls.

Two things the engine has to do that are not obvious. A control stops the native `input`/`change`
so its own re-emitted one is the public surface, and `$emit` does not bubble, so the form listens in
the **capture** phase and defers the read to a microtask: capture is too early to see the control's
own value, and a microtask queued during a dispatch runs once that dispatch has finished. And a
control's `name` is a **path**, not a key (`links[0].url`), so `collectFormData` reassembles a
nested shape from the names alone; `form/path.js` is that reader.

Deciding what a field list contains is not this package's: `@bootstrapp/form` reads a model's
`$form` block, a schema that has none, or a variable spec. `FormField` stays here because it is
`<lc-form>`'s prop contract, and that package extends it as a type-only edge.

## Stores

`toasts` (`feedback/toasts.js`) and `overlays` (`overlay/stack.js`): plain modules on light's
signals, with no `$APP` slot, so a component works wherever it is rendered without the host
declaring anything. Anything that raises a toast imports `toasts`.

## Instance surface

Every `_`-prefixed field is a declared `props` entry, `reactive: false` for a plain handle. A
field first assigned in a hook is not a declaration.

Every name the engine puts on the instance is `$`-prefixed, so the whole `_` namespace is yours
and a collision is not possible. It was, until 2026-09-10: the engine held nineteen `_` names and
`lc-scroller` shipped broken for declaring `_update`, because `View.define` throws on a
collision and the loader swallows the throw into a console error, leaving the tag simply never
upgraded. DOM method names (`remove`, `click`, `focus`, `closest`) are still refused that way.

## Listeners and teardown

`connected()` runs on every mount and the `$own` registry is drained and cleared before it runs
again, so a listener added there without a matching removal is added again on every remount, and an
anonymous handler cannot be removed afterwards even deliberately. Name the handler, add it,
`$own` the removal. `light/host-listener-removed` fails the package otherwise.

A listener added in `firstUpdated()` is different: that hook runs once per element, not once per
mount, so it neither doubles nor wants a teardown.

## The catalogue

The catalogue, each component's documentation page and the theme editor are
`@bootstrapp/showcase`, a framework-side package that reads this one; `projects/light` (light's `website/`) is the site
around it and the IDE opens the same pages as tabs. What this package owns is the demo beside
each component.

**A component page is drawn from two things and nothing else**: its `props` block, and the
`<component>.demo.js` beside it. A demo is a `description`, a `preview` (a zero-argument arrow
returning the miniature the catalogue's card shows, sized for a 100px box, with `previewWidth`
when it needs more room and the card scales it), an `examples` array of
`{ title, description?, render }` where `render` is a plain arrow returning one template, and an
optional `slot` for what the playground puts inside the component. A preview is static: nothing
async, no global listener, no data query, no overlay in its open state (an overlay's preview is a
poster built from light primitives). The snippet under an example
is `render.toString()`, so there is no second copy of the markup to drift. The showcase's
`lib/demos.js` loads one; `check/component-has-demo` fails the package when a component has none.

Two things follow from examples being real code rather than strings in a comment. Every `view/*`
and `router/*` rule runs on them, so a demo that binds a boolean as `.prop=` or links to a
root-absolute path fails the package. And a demo cannot reach `this`: it is a module, so anything
an example needs is a module-scope constant above it.

A skin is a whole preset applied to each stage through `applyScopedTheme`, so the chrome around it
keeps the host's theme and two tabs can wear two skins. The showcase's `lib/skins.js` owns that;
nothing in it writes to `:root` or persists a theme.

## Props

A boolean prop (`open: false` or `T.boolean(...)`) binds as `?kebab-attr=${v}`, never `.prop=`. Exceptions: `attribute: false`, `sync:`,
and `defaultValue: true`, because a removed attribute cannot push false over a true default.

## Tests

`*.browser.test.js` runs in Chromium, everything else under `node --test`. The browser partition
runs with no `$APP` at all: a test imports a definition and calls `View.define` itself. The same files run under `light test` in the light repo.

Two things a synthetic event cannot do. `setPointerCapture` throws for a pointerId no device owns,
so a test of `withPointerDrag`'s capture mode stubs the three capture methods and says why at the
top of the file; what those cases prove is the bookkeeping, not the platform's retargeting. And a
raw-touch gesture cannot be driven at all, so `bottom-sheet` and `drag-panel`'s touch path and
`drawer`'s swipe-to-close are verified on a device, not here.

`mock.timers` throws in the browser partition. Pass a clock in or drive a short real duration.

`form/form.browser.test.js` pins the public surface four consumers reach through `querySelector`:
`submit`, `validate`, `collectFormData`, `serialize`, `deserialize`, `setErrors`, `clearErrors`.
Three of its cases pinned a bug before it was fixed and now pin the fix, each still marked.

`<lc-link>` declares `click` as a property, which shadows `HTMLElement.prototype.click` on it and
on `<lc-button>`, so a test presses one with a `MouseEvent` rather than the method.
