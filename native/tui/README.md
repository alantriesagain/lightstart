# @bootstrapp/light/native/tui

The terminal host of the renderer: a node tree in place of the DOM, a layout and a painter in place of the browser, and the same engine, templates and views on top. Everything here compiles with scriptc to a static binary with no JavaScript engine; `index.ts` is the entry: importing it installs the terminal host and light's signals as the effect adapter, and it re-exports the html core, the signals, the view core and everything here. `tdom.ts` is the same terminal tree as one import without installing it, for code that runs several hosts side by side.

```
node native/tui/bench.js   # 10k keyed rows, update every 10th: node against the native binary
node native/tui/demo.js    # a counter button, a scrolling list, an editor; --log <file> records what happens
native/tui/pty.sh          # builds the demo natively and drives it in a pty: click, wheel, Tab, Enter, submit
```

| File | What it owns |
|---|---|
| `node.ts` | The tree: `TRoot`, `TBox` (column or row flex, padding, border, title, scroll), `TText` (wrapped inline content), `TSpan`, `TInput` (a multi-line editor), `TRun` (a text leaf), `TAnchor`, `TFragment`; children as a doubly linked list (`firstChild`, `lastChild`, `prev`, `next`, with `childNodes()` as a snapshot), so inserting, removing and stepping to a sibling cost nothing that grows with the tree; typed props with coercion; inert attributes; handler entries; the view that owns an element; the layout caches live on the node |
| `tags.ts` | The tag table: `box`, `text`, `span`, `input` and the HTML names that map onto them with the style the name implies (`div`, `p`, `h1`, `ul`, `li`, `b`, `em`, `code`, `a`, `br`, `hr`, `textarea`, …); `createElement`, `isKnownTag`, `isKnownProp`; `TagDefinition` and `registerTag`, the tags the app `define`s |
| `host.ts` | `TermHost`: templates through the parser and `html/tokenizer.js` under the terminal's whitespace rules, attributes to props, listeners to handler entries, attach and detach of views as their boxes join or leave the root, frames through the scheduler |
| `view.ts` | `View`: a `ViewCore` that owns a box; `render()`, the lifecycle methods, `${this.child}` placement, `mount` and `unmount`; `define(tag, Class)`, the declared `prop`s and `$emit` of an element made by tag |
| `slots.ts` | `TSlotPart` and the projection of a defined element's light children into the `<slot>`s of its template |
| `classes.ts` | The `class` attribute: `ClassStyler`, `configureClasses`, the element states a prop may need (`STATE_FOCUS`, `STATE_FOCUS_WITHIN`) and the books that keep a template's own props above its classes |
| `layout.ts` | Measure and arrange: one flex axis per box, fixed sizes, scroll boxes that stick to the bottom, wrapped text cached by width, version and the style it inherits |
| `paint.ts` | A laid-out tree into a `Screen` with clipping, borders, titles, rules, the editor's caret |
| `screen.ts` | The cell grid double buffer and the diff that writes only what changed, in a synchronized update |
| `wrap.ts`, `width.ts` | Word and character wrapping over styled runs; grapheme clusters and cell widths |
| `style.ts`, `color.ts`, `ansi.ts` | Styles as numbers and bits, color names, SGR transitions, the escape sequences |
| `events.ts`, `input.ts`, `editor.ts` | Key, mouse, wheel, focus, submit and change events; bytes to key and mouse events (CSI, SS3, kitty, bracketed paste, SGR mouse reports, Alt); the editor's keys |
| `focus.ts` | The hit test under a cell, the focus order, the nearest scrolling box, the `focus` and `focus-within` states a focus move gives and takes |
| `lines.ts`, `line-view.ts` | Styled lines (`Run`, `Line`) and the `LineSource` that builds them on demand; `LineView`, the windowed list: the visible rows only, its scroll and follow mode, a `press` event per line, a drag that selects and ends in a `copy` event, the live tail redrawn on each tick, `fit` for a strip |
| `selection.ts`, `scrollbar.ts` | A selection by cells over styled lines and the text a copy gives; the scrollbar's thumb in half rows |
| `ticks.ts` | One tick for everything that moves on its own (`onTick`), the spinner's frames and `spinnerAt` |
| `scheduler.ts`, `terminal.ts`, `renderer.ts` | One frame per tick (views flush, then the renderer paints); raw mode in and out; layout, paint, diff, write, and key dispatch to the focused editor |
| `dump.ts` | A tree as indented text, for tests and dumps |
| `index.ts`, `tdom.ts` | The entry, which installs the terminal host and re-exports the html core, the signals, the view core and the terminal tree; the terminal tree alone, installing nothing |
| `app.ts` | `runApp`: a renderer over a terminal, the classes styler, the app's view mounted, its keys first, Ctrl+C quitting |
| `test-terminal.ts`, `test-views.ts`, `test-lines.ts` | The test terminal the focus test renders on; the views the parts and elements tests mount; the sources and the holder the line view test drives |
| `*.test.js` | Parts and views on the terminal host, elements made by tag, slot projection, the theme's classes on elements and on the painted screen and through the focus states, layout and paint, wrapping and widths, the editor, the input decoder, the hit test and focus ring with a renderer on a test terminal |
| `bench.js`, `microbench.js` | 10k keyed rows rendered, relabelled, reversed and cleared, under node and natively; the operations behind it timed one by one |
| `elements-bench.js` | 1k rows as plain templates, as elements made by tag and as slotted rows: create, layout, update, reverse, clear, under node and natively |
| `demo.js`, `pty.sh` | The demo screen and the pty gate that clicks, scrolls, focuses and submits in it as a binary (3.3 MB stripped) |
| `tsconfig.json` | The terminal graph: what `typecheck:native` checks against `es2024` with node types |

A component:

```js
import { View, html, signal } from "@bootstrapp/light/native/tui";

class Counter extends View {
  count = signal(0);
  render() {
    return html`<div border title="Counter">
      <p>Count: <b>${() => this.count.value}</b></p>
    </div>`;
  }
}
```

A component a template names by tag, as a page names a custom element:

```ts
import { View, define, html } from "@bootstrapp/light/native/tui";

class TaskRow extends View {
  task = this.prop<Task | null>("task", null);
  override render(): unknown {
    const task = this.task.value;
    return task === null ? null : html`<p @click=${() => this.$emit("toggle", task)}>${task.title}</p>`;
  }
}
define("task-row", TaskRow);
```

`define(tag, Class)` registers a lowercase hyphenated tag once; wherever a template writes `<task-row .task=${task}></task-row>` (always with the closing tag), the host makes a view with `new Class()` and its box is the element, attached, detached and disposed with the tree. A prop declared with `prop(name, initial)` in a field initializer is a `Prop<T>`, read as `.value`; the element's attributes and `.prop=` bindings reach it by its lowercase name, a string taking the type of the prop's current value (`limit="3"` lands as a number, a bare attribute as `true`), and a name the view did not declare stays the box's (`flex=1 border` style the element). `$emit(type, detail)` dispatches a `CustomEvent` from the box, which bubbles to a parent's `@type=` handler. The children a template writes inside the tag project into the `<slot>`s of the view's template, the first slot of their name (`slot="x"`) in document order: a slot holding them parks its fallback, shows it again when it empties, says so with an `assigned` attribute and receives a `slotchange`; children naming a slot the render lacks wait unpainted until one appears; a parent's bindings inside slotted content keep updating. A slot is a plain box in the layout. A view the app constructs and places with `${view}` is the app's to dispose, whether or not its class is defined.

A long list is a `LineView` over a `LineSource`, since the layout measures every child of a box: the source answers `count()` and builds `line(index, width)` on demand, the view renders the rows that fit, scrolls them (the wheel, `scroll`, `page`, `toEnd`; `show(source, follow)` follows the end as lines come), draws a scrollbar in its last cell while the lines overflow, and turns the mouse into a `press` event (a `LinePress`, the line and the column) or, after a drag, a `copy` event (a `LineCopy`, the text and the rows), both handled on a parent's template with `@press=` and `@copy=`. A source's `liveFrom()` names the first line that moves on its own (a spinner, a clock): that tail is a view of its own, redrawn on each tick, and a run whose `live` is `"spinner"` draws as the spinner's frame. With `fit`, every line and no bar: a strip of a status band.

A signal read in `render()` re-renders the view on the next frame; a signal read in a thunk (`${() => …}`) recommits one part. Templates read like HTML: `div` and the other block names are boxes, `p` and the heading names are text, `b`, `em` and the rest are spans with their style, `textarea` is an editor. `id`, `style` and any other attribute an element has no prop for are kept on it and change nothing. `class` is kept too, and inert until the app installs a styler with `configureClasses(styler)`, the terminal's half of the theme's utility classes (`@bootstrapp/light/theme/terminal`): from then on a class list becomes the element's props. A prop the template writes with any value, as an attribute or a `.prop=` property, is the template's whatever the attribute order, and classes never touch it (`<div flex=2 class="flex-1">` and `<div class="flex-1" flex=2>` both have `flex` 2); a removal (`nothing`) hands it back to the classes; a class list that stops implying a prop resets it to its default. A prop may come with a state (`focus:`, `focus-within:`), the styler's answer to a variant: it applies while the element has that state, over the base, and the renderer gives the focused element and its ancestors their states when the focus moves, so their classes follow; a focused element that leaves the tree loses the focus at the next frame, and its old ancestors their `focus-within`. Style props inherit as on a page, so a color or a weight on a box reaches every text inside it; a tag's own style (`h1` bold) is written straight to the element and a class that set and dropped `bold` resets it. The mapping of classes to props, and what a terminal ignores, is in the theme's README. Whitespace follows the terminal: blank text between block children is dropped, inline text collapses its spaces and loses them at the edges of a text.

The props: `box` takes `direction`, `flex`, `width`, `height`, `padding`, `gap`, `border`, `title`, `scroll`, `scrollTop`, `stickToBottom`, `align`; `text` takes `wrap` (`word`, `char`, `none`); `input` takes `placeholder`, `minLines`, `maxLines` and `.value`; every element takes `fg`, `bg`, `bold`, `dim`, `italic`, `underline`, `inverse`, `strike`, `hidden`. Events: `@key`, `@submit`, `@change`, `@click`, `@mousedown`, `@mouseup`, `@mousemove`, `@wheel`, `@focus`, `@blur`; a handler receives the event, typed as the class it expects (`KeyEvent`, `MouseEvent`, `WheelEvent`, `FocusEvent`, `SubmitEvent`, `ChangeEvent`, `CustomEvent` from a view's `$emit`), and no `this`; one that calls `event.consume()` stops the bubbling.

The mouse and the focus: the renderer turns the terminal's mouse reports on, a press focuses the focusable element under the pointer, a release on the same element clicks it, the wheel scrolls the nearest scrolling box under the pointer unless a `@wheel` handler consumed it. Inputs, `button` elements, and any element with a `tabindex` attribute or a `@click` handler are focusable unless `disabled`; Tab and Shift+Tab move the focus along them in document order, Enter and Space click the focused one, and a focused element other than an input shows inverse. The first focusable element marked `autofocus` takes the focus on the first frame that shows it, unless something already holds it. Shift-drag stays the terminal's own selection.

## Writing an app

`examples/tasks` is the reference: light's three parts and two calls from the kit. widecode, in a repository of its own, is built the same way on the packages under `packages/`.

- **Models** (`models/*.js`): `defineModel(name, { field: T.type(options) })` over `T` from `@bootstrapp/light/types`. The row type is read off the model, `type Task = ModelRow<typeof tasks>` (`@bootstrapp/light/model`): a field declared `required: true` or given a default is on every stored row, the others are optional, and `id` is a string. A model written in TypeScript holds its schema in a `const schema: ModelSchema` (the descriptors' own types do not lower natively, probe p-ak), so its rows read as `Row`, through fields typed `unknown`.
- **A controller** (`controllers/*.js`): `defineController({ name, props, sync, ...methods })` from `@bootstrapp/light/controller`, its rows bound to live queries of the models with `sync: { rows: { to: tasks, query, dependsOn } }`. The module registers the model binder first, `registerSyncBinder(modelBinder)` from `@bootstrapp/light/model/binder`, because `defineController` checks its `sync:` targets as the module loads; registering it again changes nothing. In TypeScript the controller is a `Controller` subclass from `@bootstrapp/light/controller/class` (`controller/README.md`, "In TypeScript"), since `defineController`'s literal does not lower from TypeScript. The logic lives here.
- **Views** (`views/*.ts`): `View` subclasses from `@bootstrapp/light/native/tui`, in TypeScript because scriptc compiles a subclass of a TypeScript class reliably only when the subclass is TypeScript too. A view a template names by tag is `define("task-row", TaskRow)`, its attributes and `.prop=` bindings the `prop<T>(name, initial)` fields. An app's view calls the controller for the change it wants (`board.toggle(task.id, task.done)`); `$emit` is how a reusable component talks to a parent. An editor the app owns is a field, `readonly input = new TInput("textarea")`, placed with `${this.input}`; `find(node, test)` reaches any other element; `e.typed("d")` on a `KeyEvent` is a plain key.
- **The entry** (`main.js`): `openJsonl({ name, dir, io, models })` from `@bootstrapp/light/model/jsonl` opens the store over the models' JSONL files in `dir` through an `io` (the example's `lib/file-io.ts`, over `node:fs`) and makes it what every model call goes through; `await controller.$ready` waits for the first load; `runApp({ app, term, classes, onKey })` from `@bootstrapp/light/native/tui` mounts the app's view on a renderer over the terminal, installs the baked classes, and hands every key to `onKey` first, Ctrl+C quitting when `onKey` did not take it.
- **The test** (`tasks.test.js`): the same `openJsonl` over an in-memory `io` and the same `runApp` over `native/tui/test-terminal.ts`, keys pushed through the renderer's decoder and the checks reading the painted screen. It builds natively the same way and must print what it prints under node.
- **The classes**: the utility classes the views write are baked ahead of time into a table (`light classes:bake`), so the binary carries the table and not the classes engine; `verify` checks the table is current.

## Measurements

Measured with `node native/tui/bench.js` against the stripped binary on 2026-10-12, before and after the terminal tree's children became a linked list and its layout caches moved onto the node:

| Step | node, array | node, linked | native, array | native, linked |
|---|---|---|---|---|
| create 10k keyed rows | 313 ms | 64 ms | 8472 ms | 3289 ms |
| layout 10k rows | 84 ms | 41 ms | 1065 ms | 859 ms |
| update every 10th row | 22 ms | 9 ms | 237 ms | 183 ms |
| reverse 10k keyed rows | 1704 ms | 27 ms | 4563 ms | 542 ms |
| clear | 16 ms | 10 ms | 243 ms | 339 ms |

The quadratic sibling scan is gone on both. Natively a single insert got dearer (10k appends: 104 ms as an array, 288 ms linked), because every link is several field writes on an object the compiler keeps in its dynamic representation, where a write is a named lookup; that is why the 1k-row create is slower linked (232 ms to 352 ms) while 10k is 2.6 times faster. On the harness's screen the change is invisible: first frame 10 to 18 ms, 3 ms per keystroke, 5.8 MB resident.

Measured on 2026-10-13, medians of three, as the core moved from JavaScript to TypeScript (scriptc 0.2.10 for the first two native columns, the fork with the two fixes, on 0.3.1, for the third):

| Step | node | native, all JavaScript | native, terminal host in TypeScript | native, core in TypeScript | native, no method-replacing write |
|---|---|---|---|---|---|
| create 10k keyed rows | 72 ms | 3634 ms | 1459 ms | 611 ms | 90 ms |
| layout 10k rows | 41 ms | 948 ms | 23 ms | 19 ms | 12 ms |
| update every 10th row | 9 ms | 185 ms | 179 ms | 101 ms | 26 ms |
| reverse 10k keyed rows | 21 ms | 534 ms | 403 ms | 328 ms | 44 ms |
| clear | 11 ms | 384 ms | 160 ms | 66 ms | 21 ms |

Measured on 2026-10-17 with `node native/tui/elements-bench.js` and its stripped binary (the fork's `light-integration` on 0.3.5), medians of three after a silent warm-up pass, 1k rows each way: plain keyed `<text>` rows, `<bench-row .row=${r}>` elements made by tag (`define`), and keyed rows slotted into a `<bench-card>`; the frame is flushed inside each timed step:

| Step (1k rows) | plain, node | plain, native | elements, node | elements, native | slotted, node | slotted, native |
|---|---|---|---|---|---|---|
| create | 5.1 ms | 4.6 ms | 8.6 ms | 19.8 ms | 6.9 ms | 5.2 ms |
| layout | 2.4 ms | 1.0 ms | 2.3 ms | 1.3 ms | 1.3 ms | 1.1 ms |
| update every 10th | 0.8 ms | 1.5 ms | 0.7 ms | 1.6 ms | 0.4 ms | 1.6 ms |
| reverse | 1.9 ms | 2.6 ms | 0.8 ms | 2.4 ms | 1.1 ms | 2.7 ms |
| clear | 1.3 ms | 1.4 ms | 1.5 ms | 2.5 ms | 1.0 ms | 1.6 ms |

An element made by tag costs about 20 µs to create natively, 4 times a plain row (a view, its box, a render into it), about 1 µs more than a plain row to re-render on a prop change (the 100 re-rendered elements add 0.1 ms) and 1 µs more to dispose; a slot costs nothing a row would not. A screen of 200 such elements builds in 4 ms, inside the first frame's budget, and a keystroke that changes one row costs the microseconds of that row.

A class from a JavaScript file pays bookkeeping on every field write once its instances reach an `unknown`, which was half of this benchmark's time; a TypeScript class does not (vercel-labs/scriptc#934). The last column removes one write, `oldParts[(oldIndex as number)] = null` in `html/parts.ts`: scriptc read its key as `number | undefined`, an unknown key, and treated every method in the program as replaceable, so each call went through a boxing wrapper. The index is narrowed now. What remains is mostly boxing: class instances wrapped to cross the engine's `unknown` boundaries (the host seam's nodes, template values) and released again, and the cycle collector.

With the core in JavaScript, the binary was an order of magnitude slower than V8 on this engine. `native/tui/microbench.js` times the operations one by one, and probes p-n to p-s pin the cause: in scriptc 0.2.10 an instance of any class whose methods are called costs 1 to 4 µs to allocate, 0.35 µs per field write and about 0.5 µs per method call, while a class used as plain data costs what C does; a `Map` keyed by objects scales linearly with its size. A terminal screen holds hundreds of nodes, not ten thousand, so a frame still takes milliseconds; the gap is the compiler's to close, and `native/tui/microbench.js` is the yardstick for each release.
