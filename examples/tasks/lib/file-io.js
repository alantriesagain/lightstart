/**
 * @file The JSONL adapter's files on the local disk, through `node:fs`: a
 * file's new text goes to a file beside it, which then moves over it.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

/** @import { JsonlIO } from "@bootstrapp/light/model" */

/**
 * The IO for a data directory, created when it is missing.
 * @param {string} dir
 * @returns {JsonlIO}
 */
export const fileIO = (dir) => {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return {
    read: (path) => (existsSync(path) ? readFileSync(path, "utf8") : null),
    append: (path, text) => appendFileSync(path, text),
    write: (path, text) => {
      writeFileSync(`${path}.tmp`, text);
      renameSync(`${path}.tmp`, path);
    },
  };
};
