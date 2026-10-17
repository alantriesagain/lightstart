# @bootstrapp/light/tdom

The terminal host of the renderer: a node tree in place of the DOM, a layout and a painter in place of the browser, and the same engine, templates and views on top. Everything here compiles with scriptc to a static binary with no JavaScript engine; `native/index.js` is the entry that installs it.

| File | What it owns |
|---|---|
| `node.ts` | The tree: `TRoot`, `TBox` (column or row flex, padding, border, title, scroll), `TText` (wrapped inline content), `TSpan`, `TInput` (a multi-line editor), `TRun` (a text leaf), `TAnchor`, `TFragment`; children as a doubly linked list (`firstChild`, `lastChild`, `prev`, `next`, with `childNodes()` as a snapshot), so inserting, removing and stepping to a sibling cost nothing that grows with the tree; typed props with coercion; inert attributes; handler entries; the view that owns an element; the layout caches live on the node |
| `tags.ts` | The tag table: `box`, `text`, `span`, `input` and the HTML names that map onto them with the style the name implies (`div`, `p`, `h1`, `ul`, `li`, `b`, `em`, `code`, `a`, `br`, `hr`, `textarea`, …); `createElement`, `isKnownTag`, `isKnownProp`; `TagDefinition` and `registerTag`, the tags the app `define`s |
| `host.ts` | `TermHost`: templates through the parser and `html/tokenizer.js` under the terminal's whitespace rules, attributes to props, listeners to handler entries, attach and detach of views as their boxes join or leave the root, frames through the scheduler |
| `view.ts` | `View`: a `ViewCore` that owns a box; `render()`, the lifecycle methods, `${this.child}` placement, `mount` and `unmount`; `define(tag, make)`, the declared `prop`s and `$emit` of an element made by tag |
| `slots.ts` | `TSlotPart` and the projection of a defined element's light children into the `<slot>`s of its template |
| `layout.ts` | Measure and arrange: one flex axis per box, fixed sizes, scroll boxes that stick to the bottom, wrapped text cached by version |
| `paint.ts` | A laid-out tree into a `Screen` with clipping, borders, titles, rules, the editor's caret |
| `screen.ts` | The cell grid double buffer and the diff that writes only what changed, in a synchronized update |
| `wrap.ts`, `width.ts` | Word and character wrapping over styled runs; grapheme clusters and cell widths |
| `style.ts`, `color.ts`, `ansi.ts` | Styles as numbers and bits, color names, SGR transitions, the escape sequences |
| `events.ts`, `input.ts`, `editor.ts` | Key, mouse, wheel, focus, submit and change events; bytes to key and mouse events (CSI, SS3, kitty, bracketed paste, SGR mouse reports, Alt); the editor's keys |
| `focus.ts` | The hit test under a cell, the focus order, the nearest scrolling box |
| `scheduler.ts`, `terminal.ts`, `renderer.ts` | One frame per tick (views flush, then the renderer paints); raw mode in and out; layout, paint, diff, write, and key dispatch to the focused editor |
| `dump.ts` | A tree as indented text, for tests and dumps |

A component:

```js
import { View, html, signal } from "@bootstrapp/light/native/index.js";

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
import { View, define, html } from "@bootstrapp/light/native/index.js";

class TaskRow extends View {
  task = this.prop<Task | null>("task", null);
  override render(): unknown {
    const task = this.task.value;
    return task === null ? null : html`<p @click=${() => this.$emit("toggle", task)}>${task.title}</p>`;
  }
}
define("task-row", () => new TaskRow());
```

`define(tag, make)` registers a lowercase hyphenated tag once; wherever a template writes `<task-row .task=${task}></task-row>` (always with the closing tag), the host makes the view and its box is the element, attached, detached and disposed with the tree. A prop declared with `prop(name, initial)` in a field initializer is a `Prop<T>`, read as `.value`; the element's attributes and `.prop=` bindings reach it by its lowercase name, a string taking the type of the prop's current value (`limit="3"` lands as a number, a bare attribute as `true`), and a name the view did not declare stays the box's (`flex=1 border` style the element). `$emit(type, detail)` dispatches a `CustomEvent` from the box, which bubbles to a parent's `@type=` handler. The children a template writes inside the tag project into the `<slot>`s of the view's template, the first slot of their name (`slot="x"`) in document order: a slot holding them parks its fallback, shows it again when it empties, says so with an `assigned` attribute and receives a `slotchange`; children naming a slot the render lacks wait unpainted until one appears; a parent's bindings inside slotted content keep updating. A slot is a plain box in the layout. A view the app constructs and places with `${view}` is the app's to dispose, whether or not its class is defined.

A signal read in `render()` re-renders the view on the next frame; a signal read in a thunk (`${() => …}`) recommits one part. Templates read like HTML: `div` and the other block names are boxes, `p` and the heading names are text, `b`, `em` and the rest are spans with their style, `textarea` is an editor. `class`, `id`, `style` and any other attribute an element has no prop for are kept on it and change nothing. Whitespace follows the terminal: blank text between block children is dropped, inline text collapses its spaces and loses them at the edges of a text.

The props: `box` takes `direction`, `flex`, `width`, `height`, `padding`, `gap`, `border`, `title`, `scroll`, `scrollTop`, `stickToBottom`, `align`; `text` takes `wrap` (`word`, `char`, `none`); `input` takes `placeholder`, `minLines`, `maxLines` and `.value`; every element takes `fg`, `bg`, `bold`, `dim`, `italic`, `underline`, `inverse`, `strike`, `hidden`. Events: `@key`, `@submit`, `@change`, `@click`, `@mousedown`, `@mouseup`, `@mousemove`, `@wheel`, `@focus`, `@blur`; a handler receives the event, typed as the class it expects (`KeyEvent`, `MouseEvent`, `WheelEvent`, `FocusEvent`, `SubmitEvent`, `ChangeEvent`, `CustomEvent` from a view's `$emit`), and no `this`; one that calls `event.consume()` stops the bubbling.

The mouse and the focus: the renderer turns the terminal's mouse reports on, a press focuses the focusable element under the pointer, a release on the same element clicks it, the wheel scrolls the nearest scrolling box under the pointer unless a `@wheel` handler consumed it. Inputs, `button` elements, and any element with a `tabindex` attribute or a `@click` handler are focusable unless `disabled`; Tab and Shift+Tab move the focus along them in document order, Enter and Space click the focused one, and a focused element other than an input shows inverse. The first focusable element marked `autofocus` takes the focus on the first frame that shows it, unless something already holds it. Shift-drag stays the terminal's own selection.
