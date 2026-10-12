# @bootstrapp/light/tdom

The terminal host of the renderer: a node tree in place of the DOM, a layout and a painter in place of the browser, and the same engine, templates and views on top. Everything here compiles with scriptc to a static binary with no JavaScript engine; `native/index.js` is the entry that installs it.

| File | What it owns |
|---|---|
| `node.js` | The tree: `TRoot`, `TBox` (column or row flex, padding, border, title, scroll), `TText` (wrapped inline content), `TSpan`, `TInput` (a multi-line editor), `TRun` (a text leaf), `TAnchor`, `TFragment`; typed props with coercion; inert attributes; handler entries; the view that owns an element |
| `tags.js` | The tag table: `box`, `text`, `span`, `input` and the HTML names that map onto them with the style the name implies (`div`, `p`, `h1`, `ul`, `li`, `b`, `em`, `code`, `a`, `br`, `hr`, `textarea`, …); `createElement`, `isKnownTag`, `isKnownProp` |
| `host.js` | `TermHost`: templates through the parser and `html/tokenizer.js` under the terminal's whitespace rules, attributes to props, listeners to handler entries, attach and detach of views as their boxes join or leave the root, frames through the scheduler |
| `view.js` | `View`: a `ViewCore` that owns a box; `render()`, the lifecycle methods, `${this.child}` placement, `mount` and `unmount` |
| `layout.js` | Measure and arrange: one flex axis per box, fixed sizes, scroll boxes that stick to the bottom, wrapped text cached by version |
| `paint.js` | A laid-out tree into a `Screen` with clipping, borders, titles, rules, the editor's caret |
| `screen.js` | The cell grid double buffer and the diff that writes only what changed, in a synchronized update |
| `wrap.js`, `width.js` | Word and character wrapping over styled runs; grapheme clusters and cell widths |
| `style.js`, `color.js`, `ansi.js` | Styles as numbers and bits, color names, SGR transitions, the escape sequences |
| `events.js`, `input.js`, `editor.js` | Key, mouse, wheel, focus, submit and change events; bytes to key and mouse events (CSI, SS3, kitty, bracketed paste, SGR mouse reports, Alt); the editor's keys |
| `focus.js` | The hit test under a cell, the focus order, the nearest scrolling box |
| `scheduler.js`, `terminal.js`, `renderer.js` | One frame per tick (views flush, then the renderer paints); raw mode in and out; layout, paint, diff, write, and key dispatch to the focused editor |
| `dump.js` | A tree as indented text, for tests and dumps |

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

A signal read in `render()` re-renders the view on the next frame; a signal read in a thunk (`${() => …}`) recommits one part. Templates read like HTML: `div` and the other block names are boxes, `p` and the heading names are text, `b`, `em` and the rest are spans with their style, `textarea` is an editor. `class`, `id`, `style` and any other attribute an element has no prop for are kept on it and change nothing. Whitespace follows the terminal: blank text between block children is dropped, inline text collapses its spaces and loses them at the edges of a text.

The props: `box` takes `direction`, `flex`, `width`, `height`, `padding`, `gap`, `border`, `title`, `scroll`, `scrollTop`, `stickToBottom`, `align`; `text` takes `wrap` (`word`, `char`, `none`); `input` takes `placeholder`, `minLines`, `maxLines` and `.value`; every element takes `fg`, `bg`, `bold`, `dim`, `italic`, `underline`, `inverse`, `strike`, `hidden`. Events: `@key`, `@submit`, `@change`, `@click`, `@mousedown`, `@mouseup`, `@mousemove`, `@wheel`, `@focus`, `@blur`; a handler receives the event, typed as the class it expects (`KeyEvent`, `MouseEvent`, `WheelEvent`, `FocusEvent`, `SubmitEvent`, `ChangeEvent`), and no `this`; one that calls `event.consume()` stops the bubbling.

The mouse and the focus: the renderer turns the terminal's mouse reports on, a press focuses the focusable element under the pointer, a release on the same element clicks it, the wheel scrolls the nearest scrolling box under the pointer unless a `@wheel` handler consumed it. Inputs, `button` elements, and any element with a `tabindex` attribute or a `@click` handler are focusable unless `disabled`; Tab and Shift+Tab move the focus along them in document order, Enter and Space click the focused one, and a focused element other than an input shows inverse. Shift-drag stays the terminal's own selection.
