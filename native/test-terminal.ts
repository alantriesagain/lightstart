/**
 * @file A terminal for the native tests: a 30 by 10 screen that keeps what
 * the renderer writes instead of reaching stdout. It is TypeScript because it
 * subclasses `Terminal`, and scriptc compiles a subclass of a TypeScript class
 * reliably only when the subclass is TypeScript too.
 */
import { Terminal } from "../tdom/index.ts";

export class TestTerminal extends Terminal {
  out: string;

  constructor() {
    super();
    this.cols = 30;
    this.rows = 10;
    this.out = "";
  }

  override readSize() {}

  override write(s: string) {
    this.out += s;
  }

  override enter() {}

  override leave() {}
}
