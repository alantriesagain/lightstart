/**
 * @bootstrapp/light/tdom/renderer: frames. Layout, paint, diff and write,
 * one per scheduler tick after the views flushed. A key goes to the
 * focused editor first, then bubbles from it (or the root) through the
 * element handlers; Tab and Shift+Tab move the focus along the focusable
 * elements, Enter and Space click the focused one. A mouse press focuses
 * what it lands on, a release on the same element clicks it, the wheel
 * scrolls the nearest scrolling box under the pointer.
 */
import { CLEAR, CURSOR_HIDE, CURSOR_SHOW, cup } from "./ansi.ts";
import { FocusEvent, KeyEvent, MouseEvent, WheelEvent } from "./events.ts";
import { editorHandleKey } from "./editor.ts";
import { hitTest, isFocusable, nextFocusable, scrollBoxOf } from "./focus.ts";
import { InputDecoder } from "./input.ts";
import { layout, scrollBy } from "./layout.ts";
import { TElement, TInput, TRoot } from "./node.ts";
import { Caret, Clip, paint } from "./paint.ts";
import { Screen, diffScreens } from "./screen.ts";
import { FLUSH_RENDER, frames } from "./scheduler.ts";
import { DEFAULT_STYLE } from "./style.ts";
import { Terminal } from "./terminal.ts";

export class Renderer {
  term: Terminal;
  root: TRoot;
  front: Screen;
  back: Screen;
  focus: TElement | null;
  pressed: TElement | null;
  decoder: InputDecoder;
  cursorShown: boolean;
  stopped: boolean;
  frameCount: number;
  lastFrameMs: number;
  lastOutBytes: number;
  onKey: ((e: KeyEvent) => boolean) | null;

  constructor(term: Terminal, root: TRoot) {
    this.term = term;
    this.root = root;
    this.front = new Screen(term.cols, term.rows);
    this.back = new Screen(term.cols, term.rows);
    this.focus = null;
    this.pressed = null;
    this.decoder = new InputDecoder((e) => this.dispatchKey(e));
    this.decoder.onMouse = (e) => this.dispatchMouse(e);
    this.decoder.onWheel = (e) => this.dispatchWheel(e);
    this.cursorShown = false;
    this.stopped = false;
    this.frameCount = 0;
    this.lastFrameMs = 0;
    this.lastOutBytes = 0;
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

  /**
   * Give `el` the focus: the one that had it gets a blur event, the new one
   * a focus event. Null clears it.
   */
  setFocus(el: TElement | null) {
    const prev = this.focus;
    if (prev === el) return;
    this.focus = el;
    if (prev !== null) prev.dispatch(new FocusEvent("blur"));
    if (el !== null) el.dispatch(new FocusEvent("focus"));
    frames.request();
  }

  /**
   * Move the focus one step along the focusable elements, wrapping around.
   * @param delta 1 forward, -1 back
   */
  moveFocus(delta: number) {
    const current = this.focus !== null && this.focus.isConnected() ? this.focus : null;
    this.setFocus(nextFocusable(this.root, current, delta));
  }

  dispatchKey(e: KeyEvent) {
    if (this.onKey !== null && this.onKey(e)) {
      frames.request();
      return;
    }
    if (e.key === "tab" && !e.ctrl && !e.alt) {
      this.moveFocus(e.shift ? -1 : 1);
      return;
    }
    const f = this.focus;
    if (f !== null && f.isConnected()) {
      if (f instanceof TInput) {
        if (editorHandleKey(f, e)) {
          frames.request();
          return;
        }
      } else if (e.key === "enter" || (e.key === "char" && e.text === " " && !e.ctrl && !e.alt)) {
        f.dispatch(new MouseEvent("click", f.x, f.y, 0, e.ctrl, e.alt, e.shift));
        frames.request();
        return;
      }
      f.dispatch(e);
    } else this.root.dispatch(e);
    frames.request();
  }

  dispatchMouse(e: MouseEvent) {
    const hit = hitTest(this.root, e.x, e.y);
    // While a button is held, the element pressed gets the moves and the release: a drag that
    // leaves it (a selection running past its edge) is still its drag.
    const held = e.type !== "mousedown" && this.pressed !== null && this.attached(this.pressed) ? this.pressed : null;
    const target = held !== null ? held : hit;
    if (e.type === "mousedown") {
      this.pressed = target;
      if (target !== null) {
        let candidate: TElement | null = target;
        while (candidate !== null && !isFocusable(candidate)) candidate = candidate.parent;
        if (candidate !== null) this.setFocus(candidate);
      }
    }
    if (target !== null) target.dispatch(e);
    if (e.type === "mouseup") {
      const pressed = this.pressed;
      this.pressed = null;
      if (pressed !== null && pressed === hit) pressed.dispatch(new MouseEvent("click", e.x, e.y, e.button, e.ctrl, e.alt, e.shift));
    }
    frames.request();
  }

  /** Whether `el` is still in the tree this renderer draws. */
  private attached(el: TElement): boolean {
    let at: TElement | null = el;
    while (at !== null && at !== this.root) at = at.parent;
    return at === this.root;
  }

  dispatchWheel(e: WheelEvent) {
    const target = hitTest(this.root, e.x, e.y);
    const consumed = target !== null && target.dispatch(e);
    if (!consumed) {
      const box = scrollBoxOf(target);
      if (box !== null) scrollBy(box, e.delta * 3);
    }
    frames.request();
  }

  /**
   * Dispatch an event from an element, bubbling up, and request a frame.
   * @param e a UIEvent
   */
  dispatchFrom(el: TElement, e: unknown) {
    el.dispatch(e);
    frames.request();
  }
}
