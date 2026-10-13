/**
 * Probe AD's typed listeners: stdin bytes by line, and a child's stdout collected, both with
 * parameters typed in TypeScript syntax, which is where the compiler reads them.
 */
import type { Readable } from "node:stream";

export const lines = (onLine: (line: string) => void, onEnd: () => void): void => {
  const decoder = new TextDecoder();
  let pending = "";
  process.stdin.on("data", (chunk: Uint8Array) => {
    pending += decoder.decode(chunk, { stream: true });
    const parts = pending.split("\n");
    pending = parts.pop() ?? "";
    for (const part of parts) onLine(part);
  });
  process.stdin.on("end", () => {
    if (pending.length > 0) onLine(pending);
    onEnd();
  });
};

export const collect = (stream: Readable, done: (text: string) => void): void => {
  let out = "";
  stream.on("data", (chunk: Buffer) => {
    out += chunk.toString("utf8");
  });
  stream.on("end", () => done(out));
};
