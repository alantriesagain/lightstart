/**
 * @bootstrapp/light/native/tui/events: what the terminal dispatches through a
 * tree. An event bubbles from the element it targets to the root; a
 * handler that calls `consume()` stops it.
 */

export class UIEvent {
  type: string;
  consumed: boolean;

  constructor(type: string) {
    this.type = type;
    this.consumed = false;
  }

  consume() {
    this.consumed = true;
  }
}

/**
 * One key press. `key` names it: "char" for printable text (in `text`),
 * "paste" (text in `text`), or "enter", "tab", "backspace", "delete",
 * "escape", "up", "down", "left", "right", "home", "end", "pageup",
 * "pagedown", "insert", "f1" to "f12".
 */
export class KeyEvent extends UIEvent {
  key: string;
  text: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;

  constructor(key: string, text: string, ctrl: boolean, alt: boolean, shift: boolean) {
    super("key");
    this.key = key;
    this.text = text;
    this.ctrl = ctrl;
    this.alt = alt;
    this.shift = shift;
  }

  /** Whether this is the printable `text` typed on its own, without Ctrl or Alt. */
  typed(text: string): boolean {
    return this.key === "char" && this.text === text && !this.ctrl && !this.alt;
  }

  /** The text this key types on its own: a printable character or a paste, without Ctrl or Alt; "" otherwise. */
  typedText(): string {
    return (this.key === "char" || this.key === "paste") && !this.ctrl && !this.alt ? this.text : "";
  }

  describe() {
    const mods: string[] = [];
    if (this.ctrl) mods.push("ctrl");
    if (this.alt) mods.push("alt");
    if (this.shift) mods.push("shift");
    const base = this.key === "char" ? this.text : this.key === "paste" ? "paste(" + String(this.text.length) + ")" : this.key;
    mods.push(base);
    return mods.join("+");
  }
}

/** The editor submitted its content (Enter). */
export class SubmitEvent extends UIEvent {
  value: string;

  constructor(value: string) {
    super("submit");
    this.value = value;
  }
}

/** The editor's content changed. */
export class ChangeEvent extends UIEvent {
  value: string;

  constructor(value: string) {
    super("change");
    this.value = value;
  }
}

/**
 * A pointer event: "mousedown", "mouseup", "mousemove" (while a button is
 * held) or "click" (a release on the element that was pressed, or Enter
 * or Space on the focused element). `x` and `y` are cells from the top
 * left; `button` is 0 for the left, 1 for the middle, 2 for the right.
 */
export class MouseEvent extends UIEvent {
  x: number;
  y: number;
  button: number;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;

  constructor(type: string, x: number, y: number, button: number, ctrl: boolean, alt: boolean, shift: boolean) {
    super(type);
    this.x = x;
    this.y = y;
    this.button = button;
    this.ctrl = ctrl;
    this.alt = alt;
    this.shift = shift;
  }
}

/** The wheel turned at a cell: `delta` is 1 for down, -1 for up. */
export class WheelEvent extends UIEvent {
  x: number;
  y: number;
  delta: number;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;

  constructor(x: number, y: number, delta: number, ctrl: boolean, alt: boolean, shift: boolean) {
    super("wheel");
    this.x = x;
    this.y = y;
    this.delta = delta;
    this.ctrl = ctrl;
    this.alt = alt;
    this.shift = shift;
  }
}

/** An element took the focus ("focus") or lost it ("blur"). */
export class FocusEvent extends UIEvent {
  constructor(type: string) {
    super(type);
  }
}

/** What a view emits with `$emit(type, detail)`: a parent's `@type=` handler receives it, and it bubbles like every terminal event. */
export class CustomEvent extends UIEvent {
  detail: unknown;

  constructor(type: string, detail: unknown) {
    super(type);
    this.detail = detail;
  }
}
