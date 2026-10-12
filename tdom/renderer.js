/**
 * @bootstrapp/light/tdom/renderer: frames. Layout, paint, diff and write,
 * one per scheduler tick after the views flushed. A key goes to the
 * focused editor first, then bubbles from it (or the root) through the
 * element handlers.
 */
import { CLEAR, CURSOR_HIDE, CURSOR_SHOW, cup } from "./ansi.js";
import { KeyEvent } from "./events.js";
import { editorHandleKey } from "./editor.js";
import { InputDecoder } from "./input.js";
import { layout } from "./layout.js";
import { TElement, TInput, TRoot } from "./node.js";
import { Caret, Clip, paint } from "./paint.js";
import { Screen, diffScreens } from "./screen.js";
import { FLUSH_RENDER, frames } from "./scheduler.js";
import { DEFAULT_STYLE } from "./style.js";
import { Terminal } from "./terminal.js";

export class Renderer {
  /**
   * @param {Terminal} term
   * @param {TRoot} root
   */
  constructor(term, root) {
    this.term = term;
    this.root = root;
    this.front = new Screen(term.cols, term.rows);
    this.back = new Screen(term.cols, term.rows);
    /** @type {TInput | null} */
    this.focus = null;
    this.decoder = new InputDecoder((e) => this.dispatchKey(e));
    this.cursorShown = false;
    this.stopped = false;
    this.frameCount = 0;
    this.lastFrameMs = 0;
    this.lastOutBytes = 0;
    /** @type {((e: KeyEvent) => boolean) | null} */
    this.onKey = null;
    term.onInput((chunk) => this.decoder.push(chunk));
    term.onResize(() => this.resize());
    frames.onFlush(() => this.frame(), FLUSH_RENDER);
  }

  start() {
    this.term.enter();
    this.resize();
  }

  stop() {
    this.stopped = true;
    this.term.leave();
  }

  resize() {
    this.term.readSize();
    this.front = new Screen(this.term.cols, this.term.rows);
    this.back = new Screen(this.term.cols, this.term.rows);
    this.term.write(CLEAR);
    frames.request();
  }

  renderFrame() {
    const t0 = performance.now();
    layout(this.root, this.back.w, this.back.h, DEFAULT_STYLE);
    this.back.clear();
    const caret = new Caret();
    paint(this.root, this.back, new Clip(0, 0, this.back.w, this.back.h), DEFAULT_STYLE, caret, this.focus);
    let out = diffScreens(this.front, this.back);
    if (caret.visible) {
      out += cup(caret.x, caret.y);
      if (!this.cursorShown) {
        out += CURSOR_SHOW;
        this.cursorShown = true;
      }
    } else if (this.cursorShown) {
      out += CURSOR_HIDE;
      this.cursorShown = false;
    }
    this.lastFrameMs = performance.now() - t0;
    this.frameCount++;
    return out;
  }

  frame() {
    if (this.stopped) return;
    const out = this.renderFrame();
    this.lastOutBytes = out.length;
    this.term.write(out);
  }

  screenText() {
    return this.back.text();
  }

  /** @param {KeyEvent} e */
  dispatchKey(e) {
    if (this.onKey !== null && this.onKey(e)) {
      frames.request();
      return;
    }
    const f = this.focus;
    if (f !== null && f.isConnected()) {
      if (editorHandleKey(f, e)) {
        frames.request();
        return;
      }
      f.dispatch(e);
    } else this.root.dispatch(e);
    frames.request();
  }

  /**
   * Dispatch an event from an element, bubbling up, and request a frame.
   * @param {TElement} el
   * @param {unknown} e a UIEvent
   */
  dispatchFrom(el, e) {
    el.dispatch(e);
    frames.request();
  }
}
