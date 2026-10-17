/**
 * @file The JSONL adapter's files through `node:fs`: the IO for a data
 * directory, created when it is missing.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

import type { JsonlIO } from "@bootstrapp/light/model";

export const fileIO = (dir: string): JsonlIO => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return {
    read: (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : null),
    append: (path: string, text: string) => appendFileSync(path, text),
    write: (path: string, text: string) => {
      writeFileSync(`${path}.tmp`, text);
      renameSync(`${path}.tmp`, path);
    },
  };
};
