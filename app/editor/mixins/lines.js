/**
 * withLines: the content layer. Lines render in blocks; only the blocks
 * around the viewport are materialized, the rest are spacers sized from
 * the block table. One effect re-renders the lines whose text, tokens or
 * decorations changed, then writes the DOM selection back.
 */

/** @import { EditorMixinDefinition, Doc, Selection, Decoration, LineBucket, LineResult, BlockTable, TokenCache, Transaction, Language } from "../types.js" */
import { effect, signal } from "/app/light/signals/index.js";
import T from "/app/light/types/types.js";
import { defineMixin } from "/app/light/view/index.js";
import { blockOfLine, createBlockTable } from "../blocks.js";
import { bucketByLine, bucketEqual, segmentLine } from "../decorations.js";
import { line as lineOf, lineAt, lineNumberAt, mapPos, selection as makeSelection } from "../document.js";
import { createTokenCache } from "../lang/cache.js";
import { plain } from "../lang/index.js";
import { EDITOR_CSS } from "../styles.js";
import { adoptCss, caretPoint, columnOfPoint, lineElementOf, pointInLine, renderLine } from "./dom.js";

const BLOCK_SIZE = 100;

/**
 * @param {Node} root
 */
const adoptStyles = (root) => adoptCss(root, EDITOR_CSS);

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
const handle = (value) => ({ reactive: false, defaultValue: value });

const scrolled = new WeakSet();

export const withLines = defineMixin(/** @satisfies {EditorMixinDefinition} */ ({
  props: {
    lineNumbers: true,
    _edScroller: T.object(handle(null)),
    _edContent: T.object(handle(null)),
    _edBlockEls: T.array(handle([])),
    _edCache: T.object(handle(null)),
    _edTable: T.object(handle(null)),
    _edWindow: T.object(handle(null)),
    _edSyncedDoc: T.object(handle(null)),
    _edRendering: T.boolean(handle(false)),
    _edComposing: T.boolean(handle(false)),
    _edIdle: T.number(handle(0)),
    _edTick: T.object(handle(null)),
    _edObserver: T.object(handle(null)),
  },

  get contentDOM() {
    return /** @type {HTMLElement} */ (this._edContent);
  },

  get scrollDOM() {
    return /** @type {HTMLElement} */ (this._edScroller);
  },

  get blockWindow() {
    return /** @type {{ first: number, last: number }} */ (this._edWindow.value);
  },

  get hasFocus() {
    const root = /** @type {Document | ShadowRoot} */ (this.getRootNode());
    return this._edContent.contains(root.activeElement);
  },

  connected() {
    adoptStyles(this.getRootNode());
    this.classList.add("ed-root");
    const scroller = document.createElement("div");
    scroller.className = "ed-scroller";
    const content = document.createElement("div");
    content.className = "ed-content";
    content.setAttribute("role", "textbox");
    content.setAttribute("aria-multiline", "true");
    content.setAttribute("spellcheck", "false");
    content.setAttribute("autocapitalize", "off");
    content.setAttribute("autocorrect", "off");
    content.contentEditable = "plaintext-only";
    if (content.contentEditable !== "plaintext-only") content.contentEditable = "true";
    scroller.appendChild(content);
    this.appendChild(scroller);
    this._edScroller = scroller;
    this._edContent = content;
    this._edBlockEls = [];
    this._edTick = signal(0);
    this._edWindow = signal({ first: 0, last: 0 });
    this._edTable = createBlockTable(this.doc.lineCount, { blockSize: BLOCK_SIZE });
    this._edCache = createTokenCache(this.editorLanguage ?? plain);
    this._edCache.set(this.doc.lines);
    this._edSyncedDoc = this.doc;
    this.scheduleFill();

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        this.updateWindow();
      });
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    this.$own(() => {
      scroller.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    });
    const onPressBelowContent = (/** @type {MouseEvent} */ e) => {
      if (e.button !== 0 || content.contains(/** @type {Node} */ (e.target))) return;
      e.preventDefault();
      this.setCursorPosition(this.doc.length);
      this.focusEditor();
    };
    scroller.addEventListener("mousedown", onPressBelowContent);
    this.$own(() => scroller.removeEventListener("mousedown", onPressBelowContent));
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver((entries) => {
        let changed = false;
        for (const entry of entries) {
          const el = /** @type {HTMLElement} */ (entry.target);
          if (el === scroller) {
            changed = true;
            continue;
          }
          if (el.dataset.block !== undefined && !el.classList.contains("ed-gap")) {
            this._edTable.measure(Number(el.dataset.block), el.offsetHeight);
            changed = true;
          }
        }
        if (changed) this.updateWindow();
      });
      observer.observe(scroller);
      this._edObserver = observer;
      this.$own(() => observer.disconnect());
    }
    this.$own(this._edDoc.subscribe((/** @type {Doc} */ doc) => this.syncDoc(doc)));
    const run = effect(() => this.renderLines());
    this.$own(() => run.dispose());
    this.$own(() => {
      if (this._edIdle) (globalThis.cancelIdleCallback ?? clearTimeout)(this._edIdle);
    });
  },

  /**
   * @param {Doc} doc
   */
  syncDoc(doc) {
    if (doc === this._edSyncedDoc) return;
    const previous = /** @type {Doc} */ (this._edSyncedDoc);
    const tr = /** @type {Transaction | null} */ (this._edTransaction);
    const cache = /** @type {TokenCache} */ (this._edCache);
    const table = /** @type {BlockTable} */ (this._edTable);
    if (tr && tr.state.doc === doc && tr.startState.doc === previous && tr.changes.length) {
      const first = tr.changes[0];
      const last = tr.changes[tr.changes.length - 1];
      const oldFrom = lineNumberAt(previous, first.from) - 1;
      const oldTo = lineNumberAt(previous, last.to) - 1;
      const newTo = lineNumberAt(doc, mapPos(tr.changes, lineOf(previous, oldTo + 1).to, 1)) - 1;
      cache.splice(oldFrom, oldTo - oldFrom + 1, doc.lines.slice(oldFrom, newTo + 1));
      table.resize(doc.lineCount, blockOfLine(table, oldFrom + 1));
    } else {
      cache.set(doc.lines);
      table.resize(doc.lineCount, 0);
    }
    this._edSyncedDoc = doc;
    this.scheduleFill();
  },

  scheduleFill() {
    if (this._edIdle) return;
    const schedule = /** @type {(cb: (deadline: { timeRemaining(): number }) => void) => number} */ (
      globalThis.requestIdleCallback ?? ((cb) => setTimeout(() => cb({ timeRemaining: () => 4 }), 50))
    );
    this._edIdle = schedule((deadline) => {
      this._edIdle = 0;
      const done = this._edCache.fill(() => deadline.timeRemaining() > 1);
      if (!done) this.scheduleFill();
    });
  },

  updateWindow() {
    const table = /** @type {BlockTable} */ (this._edTable);
    const scroller = /** @type {HTMLElement} */ (this._edScroller);
    const next = table.windowFor(scroller.scrollTop, scroller.clientHeight || 600);
    const current = this._edWindow.peek();
    if (current.first !== next.first || current.last !== next.last) this._edWindow.value = next;
    else this._edTick.value++;
  },

  /**
   * @param {number} n 1-based
   * @returns {LineResult}
   */
  syntaxLine(n) {
    return /** @type {TokenCache} */ (this._edCache).line(n);
  },

  /**
   * @returns {{ first: number, last: number }} 1-based line numbers of the materialized window
   */
  windowLines() {
    const table = /** @type {BlockTable} */ (this._edTable);
    const win = this._edWindow.peek();
    const count = this.doc.lineCount;
    return { first: Math.min(table.linesOf(win.first).first, count), last: Math.min(table.linesOf(Math.min(win.last, table.blockCount - 1)).last, count) };
  },

  /**
   * @returns {{ from: number, to: number }} document offsets of the materialized window
   */
  windowRange() {
    const table = /** @type {BlockTable} */ (this._edTable);
    const win = this._edWindow.peek();
    const doc = this.doc;
    const first = table.linesOf(win.first).first;
    const last = table.linesOf(Math.min(win.last, table.blockCount - 1)).last;
    return { from: lineOf(doc, Math.min(first, doc.lineCount)).from, to: lineOf(doc, Math.min(last, doc.lineCount)).to };
  },

  /**
   * @returns {Decoration[]}
   */
  collectDecorations() {
    /** @type {Decoration[]} */
    const out = [];
    for (const fn of this._edRegistries.decorators) {
      const list = fn(this);
      if (list) for (const d of list) out.push(d);
    }
    return out;
  },

  renderLines() {
    const doc = /** @type {Doc} */ (this._edDoc.value);
    const sel = /** @type {Selection} */ (this._edSelection.value);
    const win = /** @type {{ first: number, last: number }} */ (this._edWindow.value);
    this._edPlugins.value;
    this._edTick.value;
    if (this._edSyncedDoc !== doc) this.syncDoc(doc);
    const table = /** @type {BlockTable} */ (this._edTable);
    const content = /** @type {HTMLElement} */ (this._edContent);
    const blocks = /** @type {HTMLElement[]} */ (this._edBlockEls);
    this._edRendering = true;
    try {
      this.classList.toggle("ed-numbered", this.lineNumbers);
      this.style.setProperty("--ed-gutter-width", `${Math.max(2, String(doc.lineCount).length)}ch`);
      this.style.setProperty("--ed-tab-size", String(this.indentSize));
      const count = table.blockCount;
      while (blocks.length > count) {
        const el = /** @type {HTMLElement} */ (blocks.pop());
        el.remove();
      }
      while (blocks.length < count) {
        const el = document.createElement("div");
        el.dataset.block = String(blocks.length);
        content.appendChild(el);
        blocks.push(el);
        this.toGap(el, blocks.length - 1);
      }
      const headLine = lineNumberAt(doc, sel.head);
      const buckets = bucketByLine(doc, this.collectDecorations(), headLine);
      const last = Math.min(win.last, count - 1);
      for (let i = 0; i < count; i++) {
        const el = blocks[i];
        if (i >= win.first && i <= last) this.materialize(el, i, doc, buckets);
        else if (!el.classList.contains("ed-gap")) {
          table.measure(i, el.offsetHeight);
          this.toGap(el, i);
        }
      }
      for (let i = 0; i < count; i++) if (blocks[i].classList.contains("ed-gap")) blocks[i].style.height = `${table.heightOf(i)}px`;
    } finally {
      this._edMutations?.takeRecords();
      this._edRendering = false;
    }
    const tr = /** @type {Transaction | null} */ (this._edTransaction);
    if (this.hasFocus && !this._edComposing && !(tr && tr.origin === "dom" && tr.state.selection === sel)) this.writeDomSelection();
    if (tr && tr.scrollIntoView && !scrolled.has(tr)) {
      scrolled.add(tr);
      this.revealPosition(sel.head, tr.scrollIntoView);
    }
  },

  /**
   * @param {HTMLElement} el
   * @param {number} index
   */
  toGap(el, index) {
    el.className = "ed-gap";
    el.setAttribute("contenteditable", "false");
    el.textContent = "";
    el.style.height = `${/** @type {BlockTable} */ (this._edTable).heightOf(index)}px`;
    this._edObserver?.unobserve(el);
  },

  /**
   * @param {HTMLElement} el
   * @param {number} index
   * @param {Doc} doc
   * @param {Map<number, LineBucket>} buckets
   */
  materialize(el, index, doc, buckets) {
    const table = /** @type {BlockTable} */ (this._edTable);
    const cache = /** @type {TokenCache} */ (this._edCache);
    const { first, last } = table.linesOf(index);
    if (el.classList.contains("ed-gap")) {
      el.className = "ed-block";
      el.removeAttribute("contenteditable");
      el.style.height = "";
      el.textContent = "";
      this._edObserver?.observe(el);
    }
    const lineEls = /** @type {HTMLElement[]} */ (Array.from(el.children).filter((c) => c.classList.contains("ed-line")));
    const wanted = last - first + 1;
    while (lineEls.length > wanted) {
      const gone = /** @type {HTMLElement & { _edAbove?: Element[], _edBelow?: Element[] }} */ (lineEls.pop());
      for (const w of [...(gone._edAbove ?? []), ...(gone._edBelow ?? [])]) w.remove();
      gone.remove();
    }
    while (lineEls.length < wanted) {
      const div = document.createElement("div");
      div.className = "ed-line";
      el.appendChild(div);
      lineEls.push(div);
    }
    for (let n = first; n <= last; n++) {
      const lineEl = /** @type {HTMLElement & { _ed?: { text: string, result: LineResult, bucket: LineBucket | undefined, classes: string } }} */ (lineEls[n - first]);
      const l = lineOf(doc, n);
      const result = cache.line(n);
      const bucket = buckets.get(n);
      const classes = bucket ? bucket.classes.join(" ") : "";
      const hidden = bucket?.hidden ?? false;
      lineEl.dataset.ln = String(n);
      const cached = lineEl._ed;
      const same = cached && cached.text === l.text && cached.result === result && bucketEqual(cached.bucket, bucket);
      if (!same) {
        lineEl.className = `ed-line${classes ? ` ${classes}` : ""}${hidden ? " ed-hidden" : ""}`;
        if (hidden) lineEl.textContent = "";
        else renderLine(lineEl, l, segmentLine(l, result.tokens, bucket));
        this.renderBlockWidgets(el, lineEl, bucket);
        lineEl._ed = { text: l.text, result, bucket, classes };
      }
    }
  },

  /**
   * @param {HTMLElement} container
   * @param {HTMLElement & { _edAbove?: Element[], _edBelow?: Element[] }} lineEl
   * @param {LineBucket | undefined} bucket
   */
  renderBlockWidgets(container, lineEl, bucket) {
    const place = (/** @type {"above" | "below"} */ side) => {
      const current = lineEl[side === "above" ? "_edAbove" : "_edBelow"] ?? [];
      const wanted = bucket ? bucket[side] : [];
      /** @type {Element[]} */
      const next = [];
      for (const d of wanted) {
        const reused = d.key !== undefined ? current.find((c) => /** @type {HTMLElement} */ (c).dataset.key === d.key) : undefined;
        const div = reused ?? document.createElement("div");
        if (!reused) {
          div.className = "ed-block-widget";
          div.setAttribute("contenteditable", "false");
          if (d.key !== undefined) /** @type {HTMLElement} */ (div).dataset.key = d.key;
          div.appendChild(d.widget());
        }
        next.push(div);
      }
      for (const c of current) if (!next.includes(c)) c.remove();
      if (side === "above") for (const w of next) container.insertBefore(w, lineEl);
      else {
        let anchor = lineEl.nextSibling;
        for (const w of next) {
          container.insertBefore(w, anchor);
          anchor = w.nextSibling;
        }
      }
      lineEl[side === "above" ? "_edAbove" : "_edBelow"] = next;
    };
    place("above");
    place("below");
  },

  /**
   * @param {number} n 1-based
   * @returns {HTMLElement | null}
   */
  lineElement(n) {
    const table = /** @type {BlockTable} */ (this._edTable);
    const block = blockOfLine(table, n);
    const el = /** @type {HTMLElement | undefined} */ (this._edBlockEls[block]);
    if (!el || el.classList.contains("ed-gap")) return null;
    const { first } = table.linesOf(block);
    return /** @type {HTMLElement | null} */ (el.querySelector(`.ed-line[data-ln="${n}"]`) ?? el.children[n - first] ?? null);
  },

  /**
   * @param {number} pos
   * @returns {{ node: Node, offset: number }}
   */
  posToDomPoint(pos) {
    const doc = this.doc;
    const l = lineAt(doc, pos);
    const el = this.lineElement(l.number);
    if (!el) {
      const block = blockOfLine(/** @type {BlockTable} */ (this._edTable), l.number);
      const gap = this._edBlockEls[block];
      const content = /** @type {HTMLElement} */ (this._edContent);
      return { node: content, offset: Math.max(0, Array.prototype.indexOf.call(content.childNodes, gap)) };
    }
    return pointInLine(el, pos - l.from);
  },

  /**
   * @param {Node} node
   * @param {number} offset
   * @returns {number}
   */
  domPointToPos(node, offset) {
    const doc = this.doc;
    const element = /** @type {Element | null} */ (node.nodeType === Node.ELEMENT_NODE ? /** @type {Element} */ (node) : node.parentElement);
    const lineEl = lineElementOf(element);
    if (lineEl) {
      const n = Number(lineEl.dataset.ln);
      const l = lineOf(doc, Math.min(Math.max(1, n), doc.lineCount));
      return l.from + columnOfPoint(lineEl, node, offset, l.text.length);
    }
    const blockEl = /** @type {HTMLElement | null} */ (element?.closest?.("[data-block]") ?? null);
    const table = /** @type {BlockTable} */ (this._edTable);
    if (blockEl) {
      const block = Number(blockEl.dataset.block);
      const { first, last } = table.linesOf(block);
      if (node === blockEl && offset >= blockEl.childNodes.length) return lineOf(doc, last).to;
      return lineOf(doc, first).from;
    }
    if (node === this._edContent) {
      const child = /** @type {HTMLElement | undefined} */ (this._edContent.childNodes[offset]);
      if (!child) return doc.length;
      const block = Number(child.dataset?.block ?? 0);
      return lineOf(doc, table.linesOf(block).first).from;
    }
    return node.compareDocumentPosition(this._edContent) & Node.DOCUMENT_POSITION_FOLLOWING ? 0 : doc.length;
  },

  /**
   * @returns {globalThis.Selection | null}
   */
  domSelection() {
    const root = /** @type {Document | ShadowRoot} */ (this.getRootNode());
    const getter = /** @type {{ getSelection?: () => globalThis.Selection | null }} */ (root).getSelection;
    return (getter ? getter.call(root) : null) ?? document.getSelection();
  },

  /**
   * @returns {Selection | null}
   */
  readDomSelection() {
    const domSel = this.domSelection();
    if (!domSel || domSel.rangeCount === 0 || !domSel.anchorNode || !domSel.focusNode) return null;
    const content = /** @type {HTMLElement} */ (this._edContent);
    if (!content.contains(domSel.anchorNode) || !content.contains(domSel.focusNode)) return null;
    return makeSelection(this.domPointToPos(domSel.anchorNode, domSel.anchorOffset), this.domPointToPos(domSel.focusNode, domSel.focusOffset));
  },

  writeDomSelection() {
    const domSel = this.domSelection();
    if (!domSel) return;
    const sel = this.selection;
    const current = this.readDomSelection();
    if (current && current.anchor === sel.anchor && current.head === sel.head) return;
    const a = this.posToDomPoint(sel.anchor);
    const h = this.posToDomPoint(sel.head);
    try {
      domSel.setBaseAndExtent(a.node, a.offset, h.node, h.offset);
    } catch (_e) {
      this._edTick.peek();
    }
  },

  focusEditor() {
    /** @type {HTMLElement} */ (this._edContent).focus({ preventScroll: true });
    this.writeDomSelection();
  },

  /**
   * @param {number} pos
   * @returns {DOMRect | null}
   */
  coordsAtPos(pos) {
    const point = this.posToDomPoint(pos);
    if (point.node.nodeType === Node.TEXT_NODE) {
      const range = document.createRange();
      range.setStart(point.node, point.offset);
      range.setEnd(point.node, point.offset);
      const rect = range.getBoundingClientRect();
      if (rect.height > 0 || rect.width > 0) return rect;
      return point.node.parentElement?.getBoundingClientRect() ?? null;
    }
    const el = /** @type {Element} */ (point.node);
    const child = /** @type {Element | undefined} */ (el.childNodes[point.offset] instanceof Element ? el.childNodes[point.offset] : undefined);
    const rect = (child ?? el).getBoundingClientRect();
    return new DOMRect(rect.left, rect.top, 0, rect.height);
  },

  /**
   * @param {{ x: number, y: number }} point
   * @returns {number | null}
   */
  posAtCoords(point) {
    const hit = caretPoint(null, 0, point);
    if (!hit || !this._edContent.contains(hit.node)) return null;
    return this.domPointToPos(hit.node, hit.offset);
  },

  /**
   * @param {number} pos
   * @param {boolean | { y?: "nearest" | "center" }} [options]
   */
  revealPosition(pos, options = true) {
    const y = typeof options === "object" && options.y ? options.y : "nearest";
    const table = /** @type {BlockTable} */ (this._edTable);
    const scroller = /** @type {HTMLElement} */ (this._edScroller);
    const n = lineNumberAt(this.doc, pos);
    if (!this.lineElement(n)) {
      scroller.scrollTop = table.offsetOf(blockOfLine(table, n));
      this._edWindow.value = table.windowFor(scroller.scrollTop, scroller.clientHeight || 600);
    }
    const rect = this.coordsAtPos(pos);
    if (!rect) return;
    const sr = scroller.getBoundingClientRect();
    if (y === "center") scroller.scrollTop += rect.top - sr.top - sr.height / 2 + rect.height / 2;
    else if (rect.top < sr.top) scroller.scrollTop += rect.top - sr.top - 8;
    else if (rect.bottom > sr.bottom) scroller.scrollTop += rect.bottom - sr.bottom + 8;
  },

  refreshLines() {
    for (const el of /** @type {HTMLElement[]} */ (this._edBlockEls)) for (const l of el.children) delete (/** @type {HTMLElement & { _ed?: unknown }} */ (l))._ed;
    this._edTick.value++;
  },

  /** @param {{ changedProps: Map<string, unknown> }} detail */
  updated({ changedProps }) {
    if (!this._edCache) return;
    if (changedProps.has("language") || changedProps.has("path")) {
      this._edCache = createTokenCache(this.editorLanguage ?? plain);
      this._edCache.set(this.doc.lines);
      this.scheduleFill();
      this.refreshLines();
    }
    if (changedProps.has("lineNumbers") || changedProps.has("indentSize")) this._edTick.value++;
  },
}));
