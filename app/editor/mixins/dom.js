/**
 * The DOM side of a line: rendering its segments and mapping between
 * document offsets and DOM points. A line is `div.ed-line[data-ln]` whose
 * children are `span[data-off]` text runs and `span.ed-widget` widgets; an
 * empty line holds a `<br>`.
 */

/** @import { Segment, Line } from "../types.js" */

/** @type {Map<string, CSSStyleSheet>} */
const sheets = new Map();

/**
 * Adopt a stylesheet once per root; the same CSS text shares one sheet.
 * @param {Node} root
 * @param {string} css
 */
export const adoptCss = (root, css) => {
  const target = /** @type {Document | ShadowRoot} */ (root.nodeType === Node.DOCUMENT_NODE || root.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? root : document);
  if (!("adoptedStyleSheets" in target)) return;
  let sheet = sheets.get(css);
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    sheets.set(css, sheet);
  }
  if (!target.adoptedStyleSheets.includes(sheet)) target.adoptedStyleSheets = [...target.adoptedStyleSheets, sheet];
};

/**
 * @param {HTMLElement} el
 * @param {Line} line
 * @param {Segment[]} segments
 */
export const renderLine = (el, line, segments) => {
  const existing = /** @type {Record<string, Element>} */ ({});
  for (const child of el.children) {
    const key = /** @type {HTMLElement} */ (child).dataset.key;
    if (key) existing[key] = child;
  }
  const keyedWidget = (/** @type {string} */ key) => /** @type {HTMLElement | undefined} */ (existing[key]);
  el.textContent = "";
  let content = false;
  for (const s of segments) {
    if ("widget" in s) {
      const keyed = s.key !== undefined ? keyedWidget(s.key) : undefined;
      const span = keyed ?? document.createElement("span");
      if (!keyed) {
        span.className = "ed-widget";
        span.setAttribute("contenteditable", "false");
        if (s.key !== undefined) span.dataset.key = s.key;
        span.appendChild(s.widget());
      }
      span.dataset.off = String(s.from);
      span.dataset.to = String(s.to);
      el.appendChild(span);
      content = true;
      continue;
    }
    if (s.to <= s.from) continue;
    const span = document.createElement("span");
    span.dataset.off = String(s.from);
    if (s.classes.length) span.className = s.classes.join(" ");
    if (s.attrs) for (const [k, v] of Object.entries(s.attrs)) span.setAttribute(k, v);
    span.textContent = line.text.slice(s.from, s.to);
    el.appendChild(span);
    content = true;
  }
  if (!content) el.appendChild(document.createElement("br"));
};

/**
 * @param {Element | null} node
 * @returns {HTMLElement | null}
 */
export const lineElementOf = (node) => /** @type {HTMLElement | null} */ (node?.closest?.(".ed-line") ?? null);

/**
 * The DOM point for a column within a rendered line.
 * @param {HTMLElement} lineEl
 * @param {number} column
 * @returns {{ node: Node, offset: number }}
 */
export const pointInLine = (lineEl, column) => {
  /** @type {{ node: Node, offset: number } | null} */
  let last = null;
  for (const child of lineEl.children) {
    const span = /** @type {HTMLElement} */ (child);
    if (span.tagName === "BR") break;
    const off = Number(span.dataset.off ?? 0);
    if (span.classList.contains("ed-widget")) {
      const to = Number(span.dataset.to ?? off);
      if (column <= off) return last ?? { node: lineEl, offset: Array.prototype.indexOf.call(lineEl.childNodes, span) };
      if (column < to || (column === to && to > off)) return { node: lineEl, offset: Array.prototype.indexOf.call(lineEl.childNodes, span) + 1 };
      last = { node: lineEl, offset: Array.prototype.indexOf.call(lineEl.childNodes, span) + 1 };
      continue;
    }
    const text = span.firstChild;
    if (!text) continue;
    const len = span.textContent?.length ?? 0;
    if (column >= off && column <= off + len) return { node: text, offset: column - off };
    if (column < off) return last ?? { node: text, offset: 0 };
    last = { node: text, offset: len };
  }
  return last ?? { node: lineEl, offset: 0 };
};

/**
 * The column a DOM point inside a rendered line stands for.
 * @param {HTMLElement} lineEl
 * @param {Node} node
 * @param {number} offset
 * @param {number} lineLength
 * @returns {number}
 */
export const columnOfPoint = (lineEl, node, offset, lineLength) => {
  if (node === lineEl) {
    const child = /** @type {HTMLElement | undefined} */ (lineEl.childNodes[offset]);
    if (!child) return lineLength;
    if (child.nodeType === Node.ELEMENT_NODE && child.dataset?.off !== undefined) return Number(child.dataset.off);
    return lineLength;
  }
  const span = /** @type {HTMLElement | null} */ (node.nodeType === Node.TEXT_NODE ? node.parentElement : /** @type {Element} */ (node));
  const host = /** @type {HTMLElement | null} */ (span?.closest("[data-off]") ?? null);
  if (!host) return 0;
  const off = Number(host.dataset.off ?? 0);
  if (host.classList.contains("ed-widget")) return off;
  if (node.nodeType === Node.TEXT_NODE) return Math.min(lineLength, off + offset);
  return Math.min(lineLength, off + (offset > 0 ? host.textContent?.length ?? 0 : 0));
};

/**
 * The text a rendered line currently shows, widgets excluded.
 * @param {HTMLElement} lineEl
 * @returns {string}
 */
export const textOfLine = (lineEl) => {
  let text = "";
  for (const child of lineEl.childNodes)
    if (child.nodeType === Node.TEXT_NODE) text += child.textContent ?? "";
    else if (/** @type {HTMLElement} */ (child).classList?.contains("ed-widget")) continue;
    else if (/** @type {HTMLElement} */ (child).tagName !== "BR") text += child.textContent ?? "";

  return text.replace(/ /g, " ").replace(/\n/g, "");
};

/**
 * @param {Node | null} node
 * @param {number} offset
 * @param {{ x: number, y: number }} point
 * @returns {{ node: Node, offset: number } | null}
 */
export const caretPoint = (node, offset, point) => {
  const doc = /** @type {Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node, offset: number } | null, caretRangeFromPoint?: (x: number, y: number) => Range | null }} */ (document);
  if (doc.caretPositionFromPoint) {
    const p = doc.caretPositionFromPoint(point.x, point.y);
    return p ? { node: p.offsetNode, offset: p.offset } : null;
  }
  if (doc.caretRangeFromPoint) {
    const r = doc.caretRangeFromPoint(point.x, point.y);
    return r ? { node: r.startContainer, offset: r.startOffset } : null;
  }
  return node ? { node, offset } : null;
};
