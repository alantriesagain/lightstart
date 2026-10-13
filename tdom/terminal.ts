/**
 * @bootstrapp/light/tdom/terminal: raw-mode setup and teardown. Everything
 * is idempotent so every exit path restores the terminal exactly once.
 */
import { ALT_SCREEN_OFF, ALT_SCREEN_ON, CLEAR, CURSOR_HIDE, CURSOR_SHOW, HOME, MOUSE_OFF, MOUSE_ON, PASTE_OFF, PASTE_ON, RESET } from "./ansi.ts";

export class Terminal {
  cols: number;
  rows: number;
  entered: boolean;
  inputListeners: ((chunk: Uint8Array) => void)[];
  resizeListeners: (() => void)[];

  constructor() {
    this.cols = 80;
    this.rows = 24;
    this.entered = false;
    this.inputListeners = [];
    this.resizeListeners = [];
  }

  get isTTY() {
    return process.stdout.isTTY === true && process.stdin.isTTY === true;
  }

  readSize() {
    const c = process.stdout.columns;
    const r = process.stdout.rows;
    this.cols = typeof c === "number" && c > 0 ? c : 80;
    this.rows = typeof r === "number" && r > 0 ? r : 24;
  }

  /**
   * Hear every chunk the terminal sends; a Buffer is a Uint8Array, and the
   * narrower type keeps a listener callable from a program compiled natively.
   */
  onInput(fn: (chunk: Uint8Array) => void) {
    this.inputListeners.push(fn);
  }

  onResize(fn: () => void) {
    this.resizeListeners.push(fn);
  }

  write(s: string) {
    if (s.length > 0) process.stdout.write(s);
  }

  enter() {
    if (this.entered) return;
    this.entered = true;
    this.readSize();
    this.write(ALT_SCREEN_ON + CURSOR_HIDE + PASTE_ON + MOUSE_ON + CLEAR + HOME);
    if (process.stdin.isTTY === true) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (chunk: Uint8Array) => {
      for (const fn of this.inputListeners.slice()) fn(chunk);
    });
    process.on("SIGWINCH", () => {
      this.readSize();
      for (const fn of this.resizeListeners.slice()) fn();
    });
    process.on("exit", () => {
      this.leave();
    });
    process.on("SIGTERM", () => {
      this.leave();
      process.exit(143);
    });
    process.on("SIGINT", () => {
      this.leave();
      process.exit(130);
    });
  }

  leave() {
    if (!this.entered) return;
    this.entered = false;
    this.write(RESET + MOUSE_OFF + PASTE_OFF + CURSOR_SHOW + ALT_SCREEN_OFF);
    if (process.stdin.isTTY === true) process.stdin.setRawMode(false);
    process.stdin.pause();
  }
}
