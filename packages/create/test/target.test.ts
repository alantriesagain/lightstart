// node-only
/**
 * @file A target that already holds something is refused unless `--force`, before any file is
 * written.
 */
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureTarget, findCheckout, generate } from "../generate.ts";
import { KINDS } from "../kinds.ts";
import { done, eq, ok, throws } from "@light/test/assert.ts";

const base = mkdtempSync(join(tmpdir(), "create-target-"));
try {
  const target = join(base, "taken");
  ensureTarget(target, false);
  writeFileSync(join(target, "keep.txt"), "one");
  throws("a non-empty target is refused", () => ensureTarget(target, false), "not empty");
  ensureTarget(target, true);
  eq("force keeps the existing file", readdirSync(target).join(","), "keep.txt");

  const root = findCheckout();
  const web = KINDS.find((kind) => kind.name === "web");
  if (root !== null && web !== undefined) {
    let message = "";
    try {
      await generate({ kind: web, name: "demo", target, lightRoot: root, mode: "link", pm: "pnpm", install: false, force: false });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    ok("the generator refuses it too", message.includes("not empty"));
    eq("and wrote no manifest", readdirSync(target).join(","), "keep.txt");
  }
} finally {
  rmSync(base, { recursive: true, force: true });
}

done();
