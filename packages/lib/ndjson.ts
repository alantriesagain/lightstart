/**
 * @file Splits a byte stream into complete lines. `readline` cannot be used on a child's stdout under
 * scriptc, so this is the hand-rolled equivalent (same shape as the io2/ndjson probe).
 */
import { StringDecoder } from "node:string_decoder";

export class LineSplitter {
  private readonly dec = new StringDecoder("utf8");
  /** The incomplete line so far, in pieces: joined once its newline arrives, so a line of many
   * megabytes arriving in thousands of chunks costs linear time. */
  private parts: string[] = [];

  push(chunk: Buffer): string[] {
    const text = this.dec.write(chunk);
    const out: string[] = [];
    let start = 0;
    let i = text.indexOf("\n");
    while (i !== -1) {
      let line = text.slice(start, i);
      if (this.parts.length > 0) {
        this.parts.push(line);
        line = this.parts.join("");
        this.parts = [];
      }
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.length > 0) out.push(line);
      start = i + 1;
      i = text.indexOf("\n", start);
    }
    if (start < text.length) this.parts.push(text.slice(start));
    return out;
  }

  flush(): string[] {
    this.parts.push(this.dec.end());
    const rest = this.parts.join("");
    this.parts = [];
    return rest.length > 0 ? [rest] : [];
  }
}
