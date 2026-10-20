/**
 * @file What the line view test drives: numbered lines with a live one, a
 * paragraph's rows under a prefix with a decoration and a joint as a chat
 * writes them, and a holder view that records the `press` and `copy`
 * events. TypeScript because scriptc compiles a subclass of a TypeScript
 * class reliably only when the subclass is TypeScript too.
 */
import { CustomEvent, Line, LineCopy, LinePress, LineSource, LineView, View, html } from "./index.ts";

export class Numbers extends LineSource {
  n = 0;
  live = -1;

  count(): number {
    return this.n;
  }

  line(index: number, _width: number): Line {
    const l = new Line();
    if (index === this.live) {
      l.add("", "cyan").live = "spinner";
      l.add(" busy", "");
    } else l.add("line " + String(index), "");
    return l;
  }

  override liveFrom(): number {
    return this.live >= 0 && this.live < this.n ? this.live : this.n;
  }
}

export class Rows extends LineSource {
  readonly lines: Line[] = [];

  /** "› the quick / brown fox / jumps over", the prefix a decoration, the rows wrapped, the last joined with no space. */
  paragraph(): void {
    const first = new Line();
    first.add("› ", "cyan");
    first.decor = 1;
    first.add("the quick", "");
    const second = new Line();
    second.add("  ", "");
    second.decor = 1;
    second.add("brown fox", "");
    second.wrapped = true;
    const third = new Line();
    third.add("  ", "");
    third.decor = 1;
    third.add("jumps over", "");
    third.wrapped = true;
    third.joint = "";
    this.lines.push(first, second, third);
  }

  count(): number {
    return this.lines.length;
  }

  line(index: number, _width: number): Line {
    return index < this.lines.length ? this.lines[index] : new Line();
  }
}

export class Holder extends View {
  readonly view = new LineView();
  readonly presses: string[] = [];
  readonly copies: string[] = [];

  constructor() {
    super();
    this.box.flex = 1;
  }

  override render(): unknown {
    return html`<div flex=1 @press=${(e: CustomEvent) => {
      const press = e.detail;
      if (press instanceof LinePress) this.presses.push(String(press.index) + ":" + String(press.column));
    }} @copy=${(e: CustomEvent) => {
      const copy = e.detail;
      if (copy instanceof LineCopy) this.copies.push(copy.text + "/" + String(copy.rows));
    }}>${this.view}</div>`;
  }
}
