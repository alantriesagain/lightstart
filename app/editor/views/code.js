import { withBrackets, withDiff, withDocument, withInput, withLines, withPopups, withSearch } from "/app/editor/mixins/index.js";
import { withFormControl } from "/app/light/components/mixins/form-control.js";
import { defineComponent } from "/app/light/view/index.js";
import T from "/app/light/types/types.js";

export default defineComponent({
  mixins: [withFormControl, withDocument, withLines, withInput, withSearch, withBrackets, withPopups, withDiff],
  tag: "editor-code",
  class: "flex flex-col min-h-0",
  props: {
    cursor: T.number({ sync: "local", scope: "path" }),
  },
  events: {
    input: T.object({ value: T.string(), changes: T.array() }),
    change: T.object({ value: T.string() }),
    cursor: T.object({ line: T.number(), column: T.number(), position: T.number() }),
    hunks: T.object({ count: T.number() }),
  },

  connected() {
    const onCursor = (/** @type {CustomEvent<{ position: number }>} */ e) => {
      if (this.cursor !== e.detail.position) this.cursor = e.detail.position;
    };
    this.addEventListener("cursor", /** @type {EventListener} */ (onCursor));
    this.$own(() => this.removeEventListener("cursor", /** @type {EventListener} */ (onCursor)));
    if (this.cursor != null && this.cursor !== this.selection.head) this.setCursorPosition(this.cursor);
  },

  /** @param {{ changedProps: Map<string, unknown> }} detail */
  updated({ changedProps }) {
    if (changedProps.has("cursor") && this.cursor != null && this.cursor !== this.selection.head) this.setCursorPosition(this.cursor);
  },
});

/**
 * Code editor
 *
 * @component
 * @category form
 * @tag editor-code
 *
 * The in-house editor: syntax highlighting for JavaScript, CSS, HTML and
 * markdown, find and replace, bracket matching, undo history, windowed
 * rendering for big files. `value` is the text, `language` or `path` picks
 * the highlighter, `input` fires on every edit with `{ value, changes }`,
 * `cursor` with `{ line, column, position }`.
 *
 * @example
 * // A JavaScript editor
 * ```html
 * <editor-code language="javascript" value="const a = 1;"></editor-code>
 * ```
 *
 * @example
 * // Read-only sample without line numbers
 * ```html
 * <editor-code language="html" value="<p>hello</p>" readonly line-numbers="false"></editor-code>
 * ```
 *
 * @example
 * // Bound to state
 * ```js
 * html`<editor-code .value=${this.source} path="app.js" @input=${(e) => (this.source = e.detail.value)}></editor-code>`
 * ```
 */
