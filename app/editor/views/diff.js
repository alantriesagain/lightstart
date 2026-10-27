import { block } from "/app/editor/decorations.js";
import { applyPatch, parsePatch } from "/app/editor/patch.js";
import { html } from "/app/light/html/index.js";
import { defineComponent } from "/app/light/view/index.js";
import T from "/app/light/types/types.js";

/** @import { Hunk, PatchFile } from "/app/editor/types.js" */

/**
 * Two texts a patch describes, hunk by hunk, with the hunk headers kept as
 * context on both sides so the pair reads like a review page.
 * @param {PatchFile} file
 * @returns {{ original: string, value: string }}
 */
export const patchSides = (file) => {
  const left = [];
  const right = [];
  for (const h of file.hunks) {
    const header = `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@${h.header ? ` ${h.header}` : ""}`;
    left.push(header);
    right.push(header);
    for (const l of h.lines) {
      if (l.type !== "+") left.push(l.text);
      if (l.type !== "-") right.push(l.text);
    }
  }
  return { original: left.join("\n"), value: right.join("\n") };
};

/**
 * @param {Element | null} el
 * @returns {number}
 */
const lineHeightOf = (el) => {
  const line = el?.querySelector?.(".ed-line");
  const h = line ? /** @type {HTMLElement} */ (line).offsetHeight : 0;
  return h || 18;
};

export default defineComponent({
  tag: "editor-diff",
  class: "flex flex-col min-h-0",
  props: {
    original: "",
    value: "",
    patch: "",
    file: 0,
    unified: false,
    readonly: false,
    language: T.string(),
    path: T.string(),
    hunkCount: 0,
  },
  events: {
    input: T.object({ value: T.string() }),
    hunks: T.object({ count: T.number() }),
  },

  get files() {
    return this.patch ? parsePatch(this.patch) : [];
  },

  get sides() {
    const files = this.files;
    const file = files[this.file];
    if (file && this.original) return { original: this.original, value: applyPatch(this.original, file).text };
    if (file) return patchSides(file);
    return { original: this.original, value: this.value };
  },

  /**
   * @param {"left" | "right"} side
   * @returns {import("/app/editor/types.js").Decoration[]}
   */
  alignment(side) {
    const right = /** @type {(HTMLElement & { hunks?: Hunk[], doc?: import("/app/editor/types.js").Doc }) | null} */ (this.querySelector('editor-code[data-side="right"]'));
    const left = /** @type {(HTMLElement & { doc?: import("/app/editor/types.js").Doc }) | null} */ (this.querySelector('editor-code[data-side="left"]'));
    const hunks = right?.hunks;
    if (!hunks || !left?.doc || !right?.doc) return [];
    const lineHeight = lineHeightOf(side === "left" ? right : left);
    const doc = side === "left" ? left.doc : right.doc;
    const out = [];
    for (const h of hunks) {
      if (h.type === "equal") continue;
      const aCount = h.aTo - h.aFrom;
      const bCount = h.bTo - h.bFrom;
      const missing = side === "left" ? bCount - aCount : aCount - bCount;
      if (missing <= 0) continue;
      const anchor = side === "left" ? h.aTo : h.bTo;
      const height = missing * lineHeight;
      const widget = () => {
        const el = document.createElement("div");
        el.className = "ed-diff-spacer";
        el.style.height = `${height}px`;
        return el;
      };
      const key = `align:${side}:${anchor}:${height}`;
      if (anchor >= 1 && anchor <= doc.lineCount) out.push(block(anchor, { widget, side: "below", key }));
      else if (doc.lineCount) out.push(block(1, { widget, side: "above", key }));
    }
    return out;
  },

  connected() {
    const sync = (/** @type {Event} */ e) => {
      const from = /** @type {HTMLElement} */ (e.target);
      const other = /** @type {HTMLElement | null} */ (
        from === this.querySelector('editor-code[data-side="left"] .ed-scroller')
          ? this.querySelector('editor-code[data-side="right"] .ed-scroller')
          : this.querySelector('editor-code[data-side="left"] .ed-scroller')
      );
      if (other && Math.abs(other.scrollTop - from.scrollTop) > 1) other.scrollTop = from.scrollTop;
    };
    this.addEventListener("scroll", sync, true);
    this.$own(() => this.removeEventListener("scroll", sync, true));
  },

  /**
   * @param {CustomEvent<{ count: number }>} e
   */
  onHunks(e) {
    this.hunkCount = e.detail.count;
    this.$emit("hunks", { count: e.detail.count });
    for (const pane of this.querySelectorAll("editor-code")) pane.refreshPlugins();
  },

  /**
   * @param {"left" | "right"} side
   */
  attachAlignment(side) {
    return (/** @type {HTMLElement & { addDecorator?: (fn: () => unknown) => () => void, $own: (t: () => void) => void } | null} */ pane) => {
      if (!pane || !pane.addDecorator || /** @type {{ _editorAligned?: boolean }} */ (pane)._editorAligned) return;
      /** @type {{ _editorAligned?: boolean }} */ (pane)._editorAligned = true;
      pane.$own(pane.addDecorator(() => this.alignment(side)));
    };
  },

  render() {
    const { original, value } = this.sides;
    const readonly = this.readonly || Boolean(this.patch);
    if (this.unified)
      return html`<editor-code
        class="flex-1 min-h-0"
        data-side="right"
        .original=${original}
        .value=${value}
        .language=${this.language}
        .path=${this.path}
        ?readonly=${readonly}
        @input=${(/** @type {CustomEvent<{ value: string }>} */ e) => this.$emit("input", { value: e.detail.value })}
        @hunks=${(/** @type {CustomEvent<{ count: number }>} */ e) => this.onHunks(e)}
      ></editor-code>`;
    return html`<div class="flex flex-1 min-h-0 gap-px">
      <editor-code
        class="flex-1 min-w-0"
        data-side="left"
        .value=${original}
        .language=${this.language}
        .path=${this.path}
        readonly
      ></editor-code>
      <editor-code
        class="flex-1 min-w-0"
        data-side="right"
        .original=${original}
        .value=${value}
        .language=${this.language}
        .path=${this.path}
        ?readonly=${readonly}
        @input=${(/** @type {CustomEvent<{ value: string }>} */ e) => this.$emit("input", { value: e.detail.value })}
        @hunks=${(/** @type {CustomEvent<{ count: number }>} */ e) => this.onHunks(e)}
      ></editor-code>
    </div>`;
  },

  updated() {
    for (const side of /** @type {const} */ (["left", "right"])) {
      const pane = this.querySelector(`editor-code[data-side="${side}"]`);
      if (side === "left" && pane) this.attachAlignment("left")(/** @type {never} */ (pane));
      if (side === "right" && pane && !this.unified) this.attachAlignment("right")(/** @type {never} */ (pane));
    }
  },
});

/**
 * Diff view
 *
 * @component
 * @category form
 * @tag editor-diff
 *
 * Two texts side by side (or one unified editor with `unified`) with the
 * hunks marked, aligned by spacers and scrolled together. Feed it
 * `original` and `value`, or a unified `patch` (what `git diff` writes):
 * with `patch` alone it shows the hunks with their context, with `patch`
 * and `original` it reconstructs the whole modified file.
 *
 * @example
 * // Two texts side by side
 * ```html
 * <editor-diff original="a\nb\nc" value="a\nB\nc\nd" language="javascript" style="height: 200px"></editor-diff>
 * ```
 *
 * @example
 * // Unified, in one editor
 * ```html
 * <editor-diff unified original="a\nb\nc" value="a\nB\nc\nd" style="height: 200px"></editor-diff>
 * ```
 */
