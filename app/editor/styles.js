/**
 * The editor stylesheet, adopted once per root by the lines mixin. Every
 * colour goes through an `--ed-*` variable that defaults to the app's theme
 * tokens, so a theme retunes the editor without touching these rules.
 */

export const EDITOR_CSS = `
.ed-root {
  --ed-bg: var(--color-surface-darker, #1e1e1e);
  --ed-fg: var(--text-color, #e6e6e6);
  --ed-gutter: var(--text-muted, #8a8a8a);
  --ed-gutter-width: 3ch;
  --ed-caret: var(--text-color, #e6e6e6);
  --ed-selection: color-mix(in srgb, var(--color-primary, #6ea8fe) 30%, transparent);
  --ed-line-height: 1.5;
  --ed-font: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  --ed-font-size: 12px;
  --ed-search: color-mix(in srgb, var(--color-warning, #f0b429) 30%, transparent);
  --ed-search-current: color-mix(in srgb, var(--color-warning, #f0b429) 55%, transparent);
  --ed-bracket: color-mix(in srgb, var(--color-info, #6ea8fe) 35%, transparent);
  --ed-diff-insert: color-mix(in srgb, var(--color-success, #4caf50) 18%, transparent);
  --ed-diff-delete: color-mix(in srgb, var(--color-danger, #e5484d) 18%, transparent);
  --ed-diff-change: color-mix(in srgb, var(--color-warning, #f0b429) 35%, transparent);
  --tok-keyword: var(--color-secondary, #c678dd);
  --tok-atom: var(--color-info, #56b6c2);
  --tok-number: var(--color-info, #56b6c2);
  --tok-string: var(--color-success, #98c379);
  --tok-comment: var(--text-muted, #8a8a8a);
  --tok-property: var(--color-primary, #61afef);
  --tok-definition: var(--color-warning, #e5c07b);
  --tok-variable: var(--ed-fg);
  --tok-tag: var(--color-danger, #e06c75);
  --tok-attribute: var(--color-warning, #e5c07b);
  --tok-regexp: var(--color-success, #98c379);
  --tok-escape: var(--color-accent, #d19a66);
  --tok-meta: var(--text-muted, #8a8a8a);
  --tok-link: var(--color-primary, #61afef);
  --tok-mark: color-mix(in srgb, var(--ed-fg) 45%, transparent);
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  width: 100%;
  position: relative;
  background: var(--ed-bg);
  color: var(--ed-fg);
  font-family: var(--ed-font);
  font-size: var(--ed-font-size);
  line-height: var(--ed-line-height);
}
.ed-scroller { flex: 1; min-height: 0; overflow: auto; position: relative; }
.ed-content {
  outline: none;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: var(--ed-tab-size, 2);
  caret-color: var(--ed-caret);
  padding: 4px 8px 4px 0;
  min-height: 100%;
  box-sizing: border-box;
}
.ed-root.ed-numbered .ed-content { padding-left: calc(var(--ed-gutter-width) + 12px); }
.ed-root:not(.ed-numbered) .ed-content { padding-left: 8px; }
.ed-line { position: relative; min-height: calc(1em * var(--ed-line-height)); }
.ed-root.ed-numbered .ed-line::before {
  content: attr(data-ln);
  position: absolute;
  left: calc(-1 * var(--ed-gutter-width) - 12px);
  width: var(--ed-gutter-width);
  text-align: right;
  color: var(--ed-gutter);
  user-select: none;
  pointer-events: none;
}
.ed-gap { pointer-events: none; }
.ed-block { user-select: none; }
.ed-widget { display: inline; }
.ed-content ::selection { background: var(--ed-selection); }
.ed-special { opacity: 0.5; }
.ed-bracket { background: var(--ed-bracket); border-radius: 2px; }
.ed-search { background: var(--ed-search); }
.ed-search-current { background: var(--ed-search-current); outline: 1px solid var(--ed-search-current); }
::highlight(ed-search) { background-color: var(--ed-search); }
::highlight(ed-search-current) { background-color: var(--ed-search-current); }
.ed-diff-insert { background: var(--ed-diff-insert); }
.ed-diff-delete { background: var(--ed-diff-delete); white-space: pre-wrap; opacity: 0.85; }
.ed-diff-delete-line { min-height: calc(1em * var(--ed-line-height)); text-decoration: line-through; }
.ed-diff-change-text { background: var(--ed-diff-change); border-radius: 2px; }
.ed-block-widget { user-select: none; }
.ed-diff-change { background: var(--ed-diff-change); }
.ed-diff-spacer { background: repeating-linear-gradient(-45deg, transparent 0 6px, color-mix(in srgb, var(--ed-fg) 6%, transparent) 6px 12px); }
.ed-popup {
  position: absolute;
  z-index: 10;
  background: var(--color-surface-dark, #2a2a2a);
  color: var(--ed-fg);
  border: 1px solid var(--border-color, #444);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  font-family: var(--font-family-base, system-ui, sans-serif);
  font-size: 0.875rem;
}
.ed-popup[hidden] { display: none; }
.ed-completion { min-width: 12rem; max-height: 16rem; overflow: auto; padding: 4px 0; }
.ed-completion-item { display: flex; gap: 8px; align-items: baseline; padding: 6px 12px; cursor: pointer; }
.ed-completion-item[aria-selected="true"] { background: color-mix(in srgb, var(--ed-fg) 10%, transparent); }
.ed-completion-detail { color: var(--text-muted, #8a8a8a); margin-left: auto; }
.ed-tooltip { display: flex; gap: 2px; padding: 4px; }
.tok-keyword { color: var(--tok-keyword); }
.tok-atom { color: var(--tok-atom); }
.tok-number { color: var(--tok-number); }
.tok-string { color: var(--tok-string); }
.tok-comment { color: var(--tok-comment); font-style: italic; }
.tok-property { color: var(--tok-property); }
.tok-definition { color: var(--tok-definition); }
.tok-variable { color: var(--tok-variable); }
.tok-tag { color: var(--tok-tag); }
.tok-attribute { color: var(--tok-attribute); }
.tok-regexp { color: var(--tok-regexp); }
.tok-escape { color: var(--tok-escape); }
.tok-meta { color: var(--tok-meta); }
.tok-operator, .tok-punctuation { color: var(--ed-fg); }
.tok-heading { font-weight: 600; color: var(--tok-definition); }
.tok-emphasis { font-style: italic; }
.tok-strong { font-weight: 600; }
.tok-strikethrough { text-decoration: line-through; }
.tok-link { color: var(--tok-link); }
.tok-url { color: var(--tok-meta); text-decoration: underline; }
.tok-code { color: var(--tok-string); }
.tok-quote, .tok-list, .tok-hr, .tok-table, .tok-mark { color: var(--tok-mark); }
`;
