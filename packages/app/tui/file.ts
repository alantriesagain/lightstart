/**
 * @file The JSONL adapter's files through `node:fs`: the IO for a data
 * directory, made when the first write lands (a store nothing was written to
 * leaves no directory behind); a whole write lands beside the file and is
 * renamed over it.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import type { JsonlIO } from "@lightstart/light/model";

/** The JSONL adapter's files for `dir`, the directory made on the first write. */
export const fileIO = (_dir: string): JsonlIO => ({
  read: (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : null),
  append: (path: string, text: string) => {
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, text);
  },
  write: (path: string, text: string) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(`${path}.tmp`, text);
    renameSync(`${path}.tmp`, path);
  },
});
