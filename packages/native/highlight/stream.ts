/**
 * @file A bounded cursor over one line, the surface a tokenizer reads through; ported from
 * @bootstrapp/editor's lang/stream.js. Every regex passed to `match` is sticky (`y`), so it is
 * tried at the cursor and a long line stays linear.
 */

export class Stream {
  text: string;
  pos: number;
  start: number;
  end: number;

  constructor(text: string, pos: number, end: number) {
    this.text = text;
    this.pos = pos;
    this.start = pos;
    this.end = end;
  }

  /** The character at the cursor, consumed; "" at the end. */
  next(): string {
    return this.pos < this.end ? this.text.charAt(this.pos++) : "";
  }

  peek(): string {
    return this.pos < this.end ? this.text.charAt(this.pos) : "";
  }

  eat(ch: string): boolean {
    if (this.pos >= this.end || this.text.charAt(this.pos) !== ch) return false;
    this.pos++;
    return true;
  }

  /** Consume one character that `re` (non-sticky, testing one character) accepts. */
  eatClass(re: RegExp): boolean {
    if (this.pos >= this.end || !re.test(this.text.charAt(this.pos))) return false;
    this.pos++;
    return true;
  }

  eatWhileClass(re: RegExp): boolean {
    const from = this.pos;
    while (this.eatClass(re));
    return this.pos > from;
  }

  eatSpace(): boolean {
    const from = this.pos;
    while (this.pos < this.end) {
      const c = this.text.charAt(this.pos);
      if (c !== " " && c !== "\t") break;
      this.pos++;
    }
    return this.pos > from;
  }

  /** Whether `s` is at the cursor; consumed when `consume`. */
  take(s: string, consume: boolean): boolean {
    if (this.pos + s.length > this.end || !this.text.startsWith(s, this.pos)) return false;
    if (consume) this.pos += s.length;
    return true;
  }

  /** A sticky `re` matched at the cursor (consumed when `consume`), or null. */
  match(re: RegExp, consume: boolean): RegExpExecArray | null {
    re.lastIndex = this.pos;
    const m = re.exec(this.text);
    if (m === null || m.index + m[0].length > this.end) return null;
    if (consume) this.pos += m[0].length;
    return m;
  }

  skipToEnd(): void {
    this.pos = this.end;
  }

  eol(): boolean {
    return this.pos >= this.end;
  }

  current(): string {
    return this.text.slice(this.start, this.pos);
  }

  /** A stream over the same text from the cursor to `subEnd`. */
  sub(subEnd: number): Stream {
    return new Stream(this.text, this.pos, Math.min(this.end, subEnd));
  }
}

/** Read a quoted string to its closing quote, escapes included; false when the line ended first. */
export const readString = (stream: Stream, quote: string): boolean => {
  while (!stream.eol()) {
    const ch = stream.next();
    if (ch === "\\") {
      if (stream.eol()) return false;
      stream.next();
      continue;
    }
    if (ch === quote) return true;
  }
  return true;
};
