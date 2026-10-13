/**
 * @bootstrapp/light/tdom/input: bytes from the terminal into key events.
 * CSI and SS3 sequences with modifiers, the kitty keyboard protocol's `u`
 * form, bracketed paste, SGR mouse reports, Alt as an ESC prefix, control
 * characters, and UTF-8 text split into graphemes.
 */
import { KeyEvent, MouseEvent, WheelEvent } from "./events.ts";
import { graphemes } from "./width.ts";

const TILDE_KEYS: Map<number, string> = new Map([
  [1, "home"],
  [2, "insert"],
  [3, "delete"],
  [4, "end"],
  [5, "pageup"],
  [6, "pagedown"],
  [7, "home"],
  [8, "end"],
  [11, "f1"],
  [12, "f2"],
  [13, "f3"],
  [14, "f4"],
  [15, "f5"],
  [17, "f6"],
  [18, "f7"],
  [19, "f8"],
  [20, "f9"],
  [21, "f10"],
  [23, "f11"],
  [24, "f12"],
]);

const LETTER_KEYS: Map<string, string> = new Map([
  ["A", "up"],
  ["B", "down"],
  ["C", "right"],
  ["D", "left"],
  ["H", "home"],
  ["F", "end"],
  ["P", "f1"],
  ["Q", "f2"],
  ["R", "f3"],
  ["S", "f4"],
]);

const PASTE_END = "\x1b[201~";

/** An incremental UTF-8 decoder: a multi-byte sequence split across chunks completes with the next one. */
export class Utf8Decoder {
  pending: number[];

  constructor() {
    this.pending = [];
  }

  /**
   * @returns the text the bytes so far complete
   */
  write(chunk: Uint8Array): string {
    const bytes = this.pending;
    for (let i = 0; i < chunk.length; i++) bytes.push(chunk[i]);
    let out = "";
    let i = 0;
    while (i < bytes.length) {
      const b = bytes[i];
      let need = 0;
      let cp = 0;
      if (b < 0x80)
        cp = b;
       else if ((b & 0xe0) === 0xc0) {
        need = 1;
        cp = b & 0x1f;
      } else if ((b & 0xf0) === 0xe0) {
        need = 2;
        cp = b & 0x0f;
      } else if ((b & 0xf8) === 0xf0) {
        need = 3;
        cp = b & 0x07;
      } else {
        out += "\ufffd";
        i++;
        continue;
      }
      if (i + need >= bytes.length) break;
      let ok = true;
      for (let k = 1; k <= need; k++) {
        const c = bytes[i + k];
        if ((c & 0xc0) !== 0x80) {
          ok = false;
          break;
        }
        cp = (cp << 6) | (c & 0x3f);
      }
      if (!ok) {
        out += "\ufffd";
        i++;
        continue;
      }
      out += String.fromCodePoint(cp);
      i += need + 1;
    }
    this.pending = bytes.slice(i);
    return out;
  }
}

export class InputDecoder {
  deliver: (e: KeyEvent) => void;
  onMouse: ((e: MouseEvent) => void) | null;
  onWheel: ((e: WheelEvent) => void) | null;
  dec: Utf8Decoder;
  buf: string;
  pasting: boolean;
  pasteBuf: string;
  escArmed: boolean;
  escGeneration: number;
  escTimeoutMs: number;

  constructor(deliver: (e: KeyEvent) => void) {
    this.deliver = deliver;
    this.onMouse = null;
    this.onWheel = null;
    this.dec = new Utf8Decoder();
    this.buf = "";
    this.pasting = false;
    this.pasteBuf = "";
    this.escArmed = false;
    this.escGeneration = 0;
    this.escTimeoutMs = 30;
  }

  push(chunk: Uint8Array) {
    this.buf += this.dec.write(chunk);
    this.drain();
  }

  /**
   * Feed decoded text, for tests.
   */
  pushText(text: string) {
    this.buf += text;
    this.drain();
  }

  flushEscape() {
    this.escArmed = false;
    if (this.buf === "\x1b") {
      this.buf = "";
      this.deliver(new KeyEvent("escape", "", false, false, false));
    } else if (this.buf.startsWith("\x1b")) {
      this.buf = this.buf.slice(1);
      this.drain();
    }
  }

  armTimer() {
    if (this.escArmed || this.escTimeoutMs <= 0) return;
    this.escArmed = true;
    this.escGeneration++;
    const generation = this.escGeneration;
    setTimeout(() => {
      if (this.escArmed && generation === this.escGeneration) this.flushEscape();
    }, this.escTimeoutMs);
  }

  cancelTimer() {
    this.escArmed = false;
  }

  drain() {
    while (this.buf.length > 0) {
      if (this.pasting) {
        const end = this.buf.indexOf(PASTE_END);
        if (end === -1) {
          const keep = Math.min(this.buf.length, PASTE_END.length - 1);
          this.pasteBuf += this.buf.slice(0, this.buf.length - keep);
          this.buf = this.buf.slice(this.buf.length - keep);
          return;
        }
        this.pasteBuf += this.buf.slice(0, end);
        this.buf = this.buf.slice(end + PASTE_END.length);
        this.pasting = false;
        const text = this.pasteBuf.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
        this.pasteBuf = "";
        this.deliver(new KeyEvent("paste", text, false, false, false));
        continue;
      }
      const c = this.buf.charCodeAt(0);
      if (c === 0x1b) {
        const consumed = this.decodeEscape();
        if (consumed === 0) {
          this.armTimer();
          return;
        }
        this.cancelTimer();
        this.buf = this.buf.slice(consumed);
        continue;
      }
      this.cancelTimer();
      if (c < 0x20 || c === 0x7f) {
        this.buf = this.buf.slice(1);
        this.emitControl(c, false);
        continue;
      }
      let end = 1;
      while (end < this.buf.length) {
        const cc = this.buf.charCodeAt(end);
        if (cc < 0x20 || cc === 0x7f) break;
        end++;
      }
      const text = this.buf.slice(0, end);
      this.buf = this.buf.slice(end);
      for (const g of graphemes(text)) this.deliver(new KeyEvent("char", g, false, false, false));
    }
  }

  emitControl(c: number, alt: boolean) {
    if (c === 0x0d) this.deliver(new KeyEvent("enter", "", false, alt, false));
    else if (c === 0x09) this.deliver(new KeyEvent("tab", "", false, alt, false));
    else if (c === 0x7f || c === 0x08) this.deliver(new KeyEvent("backspace", "", c === 0x08, alt, false));
    else if (c === 0x1b) this.deliver(new KeyEvent("escape", "", false, alt, false));
    else if (c === 0x00) this.deliver(new KeyEvent("char", " ", true, alt, false));
    else if (c >= 0x01 && c <= 0x1a) this.deliver(new KeyEvent("char", String.fromCharCode(c + 96), true, alt, false));
    else this.deliver(new KeyEvent("char", String.fromCharCode(c + 64), true, alt, false));
  }

  /** @returns the characters one escape sequence at the start of the buffer took, 0 when incomplete */
  decodeEscape(): number {
    const b = this.buf;
    if (b.length < 2) return 0;
    const n = b[1];
    if (n === "[") {
      let i = 2;
      while (i < b.length) {
        const cc = b.charCodeAt(i);
        if (cc >= 0x40 && cc <= 0x7e) break;
        i++;
        if (i - 2 > 32) return i;
      }
      if (i >= b.length) return 0;
      const params = b.slice(2, i);
      const final = b[i];
      this.emitCsi(params, final);
      return i + 1;
    }
    if (n === "O") {
      if (b.length < 3) return 0;
      const key = LETTER_KEYS.get(b[2]);
      if (key !== undefined) this.deliver(new KeyEvent(key, "", false, false, false));
      return 3;
    }
    const cc = b.charCodeAt(1);
    if (cc === 0x1b) {
      this.deliver(new KeyEvent("escape", "", false, false, false));
      return 1;
    }
    if (cc < 0x20 || cc === 0x7f) {
      this.emitControl(cc, true);
      return 2;
    }
    const g = graphemes(b.slice(1))[0];
    this.deliver(new KeyEvent("char", g, false, true, false));
    return 1 + g.length;
  }

  emitCsi(params: string, final: string) {
    if (final === "~" && params === "200") {
      this.pasting = true;
      this.pasteBuf = "";
      return;
    }
    if (params.startsWith("<") && (final === "M" || final === "m")) {
      this.emitMouse(params.slice(1), final === "M");
      return;
    }
    const parts = params.length > 0 ? params.split(";") : [];
    const p0 = parts.length > 0 && parts[0].length > 0 ? Number(parts[0]) : 1;
    const mod = parts.length > 1 && parts[1].length > 0 ? Number(parts[1]) : 1;
    const bits = mod > 1 ? mod - 1 : 0;
    const shift = (bits & 1) !== 0;
    const alt = (bits & 2) !== 0;
    const ctrl = (bits & 4) !== 0;
    if (final === "~") {
      const key = TILDE_KEYS.get(p0);
      if (key !== undefined) this.deliver(new KeyEvent(key, "", ctrl, alt, shift));
      return;
    }
    if (final === "Z") {
      this.deliver(new KeyEvent("tab", "", false, false, true));
      return;
    }
    if (final === "u" && parts.length > 0) {
      const cp = Number(parts[0]);
      if (cp === 27) this.deliver(new KeyEvent("escape", "", ctrl, alt, shift));
      else if (cp === 13) this.deliver(new KeyEvent("enter", "", ctrl, alt, shift));
      else if (cp === 9) this.deliver(new KeyEvent("tab", "", ctrl, alt, shift));
      else if (cp === 127) this.deliver(new KeyEvent("backspace", "", ctrl, alt, shift));
      else if (Number.isFinite(cp) && cp > 0) this.deliver(new KeyEvent("char", String.fromCodePoint(cp), ctrl, alt, shift));
      return;
    }
    const key = LETTER_KEYS.get(final);
    if (key !== undefined) this.deliver(new KeyEvent(key, "", ctrl, alt, shift));
  }

  /**
   * An SGR mouse report: `CSI < b ; x ; y M` for a press, `m` for a release.
   * The low bits of `b` are the button, 4 shift, 8 alt, 16 ctrl, 32 motion,
   * 64 the wheel (64 up, 65 down).
   */
  emitMouse(params: string, pressed: boolean) {
    const parts = params.split(";");
    if (parts.length < 3) return;
    const b = Number(parts[0]);
    const x = Number(parts[1]) - 1;
    const y = Number(parts[2]) - 1;
    if (!Number.isFinite(b) || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const shift = (b & 4) !== 0;
    const alt = (b & 8) !== 0;
    const ctrl = (b & 16) !== 0;
    if ((b & 64) !== 0) {
      if (this.onWheel !== null) this.onWheel(new WheelEvent(x, y, (b & 1) === 0 ? -1 : 1, ctrl, alt, shift));
      return;
    }
    const button = b & 3;
    const motion = (b & 32) !== 0;
    const type = motion ? "mousemove" : pressed ? "mousedown" : "mouseup";
    if (this.onMouse !== null) this.onMouse(new MouseEvent(type, x, y, button === 3 ? 0 : button, ctrl, alt, shift));
  }
}
