/**
 * Probe V's stream reader. scriptc lowers a `data` listener only when its parameter is typed
 * `Buffer` or `string` in TypeScript syntax; a JSDoc type is not read there, so the one listener
 * lives in this file.
 */
import type { Readable } from "node:stream";

export const collect = (stream: Readable, done: (text: string) => void): void => {
  let out = "";
  stream.on("data", (chunk: Buffer) => {
    out += chunk.toString("utf8");
  });
  stream.on("end", () => done(out));
};
