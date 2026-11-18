import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const ALLOWED = new Set(["0px", "1px", "2px"]);
const root = new URL("../src/views/", import.meta.url).pathname;

/** @param {string} dir @returns {string[]} */
const cssFiles = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return cssFiles(path);
    return entry.endsWith(".css") ? [path] : [];
  });

describe("the site's stylesheets", () => {
  it("measure in tokens, never in pixels", () => {
    const offenders = [];
    for (const file of cssFiles(root)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        if (line.includes("--docs-") || line.trimStart().startsWith("@media")) return;
        for (const match of line.matchAll(/\b\d+(?:\.\d+)?px\b/g))
          if (!ALLOWED.has(match[0])) offenders.push(`${file.slice(root.length)}:${index + 1} ${match[0]}`);
      });
    }
    assert.deepEqual(offenders, []);
  });
});
