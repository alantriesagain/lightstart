/**
 * @bootstrapp/light/tdom/events: what the terminal dispatches through a
 * tree. An event bubbles from the element it targets to the root; a
 * handler that calls `consume()` stops it.
 */

export class UIEvent {
  /** @param {string} type */
  constructor(type) {
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
  /**
   * @param {string} key
   * @param {string} text
   * @param {boolean} ctrl
   * @param {boolean} alt
   * @param {boolean} shift
   */
  constructor(key, text, ctrl, alt, shift) {
    super("key");
    this.key = key;
    this.text = text;
    this.ctrl = ctrl;
    this.alt = alt;
    this.shift = shift;
  }

  describe() {
    /** @type {string[]} */
    const mods = [];
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
  /** @param {string} value */
  constructor(value) {
    super("submit");
    this.value = value;
  }
}

/** The editor's content changed. */
export class ChangeEvent extends UIEvent {
  /** @param {string} value */
  constructor(value) {
    super("change");
    this.value = value;
  }
}
