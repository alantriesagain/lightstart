// node-only
/**
 * @file A full build of a fixture app: the page's importmap and modules bundled, a stylesheet's
 * `@import` and `url()` asset emitted, `public/` copied, the shell rewritten to hashed files that
 * exist, `current` pointing at the build, and retention over three builds.
 */
import { mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "../build.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const fixture = fileURLToPath(new URL("./fixtures/app", import.meta.url));

const main = async (): Promise<void> => {
  const out = mkdtempSync(join(tmpdir(), "light-build-"));
  try {
    const report = await build({ root: fixture, outDir: out, minify: false });
    const buildDir = report.dir;
    eq("the build folder is builds/<id>", buildDir, join(out, "builds", report.id));
    ok("the page is written", existsSync(join(buildDir, "index.html")));

    const html = readFileSync(join(buildDir, "index.html"), "utf8");
    ok("the importmap is gone", !html.includes("importmap"));
    const scripts = [...html.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)].map((match) => match[1]!);
    eqn("both module scripts became bundles", scripts.length, 2);
    for (const src of scripts) ok(`the hashed module ${src} exists`, existsSync(join(buildDir, src)));
    const styles = [...html.matchAll(/href="([^"]+\.css)"/g)].map((match) => match[1]!);
    eqn("the stylesheet link points at one output", styles.length, 1);
    ok("the hashed stylesheet exists", existsSync(join(buildDir, styles[0]!)));

    const javascript = report.files.filter((file) => file.path.endsWith(".js")).map((file) => readFileSync(join(buildDir, file.path), "utf8")).join("\n");
    ok("the TypeScript module is bundled", javascript.includes("from typescript"));
    const css = report.files.filter((file) => file.path.endsWith(".css")).map((file) => readFileSync(join(buildDir, file.path), "utf8")).join("\n");
    ok("the @import is inlined", css.includes("color: #111111"));
    ok("the url() asset is emitted with a hash", report.files.some((file) => /^pixel-.+\.svg$/.test(file.path)));
    eq("public/ is copied as is", readFileSync(join(buildDir, "robots.txt"), "utf8"), "User-agent: *\nDisallow:\n");
    eq("current names this build", readlinkSync(join(out, "current")), join("builds", report.id));
    ok("the report has bytes for every file", report.files.every((file) => file.bytes > 0));
  } finally {
    rmSync(out, { recursive: true, force: true });
  }

  const pruneOut = mkdtempSync(join(tmpdir(), "light-build-prune-"));
  try {
    const reports = [];
    for (let i = 0; i < 3; i++) reports.push(await build({ root: fixture, outDir: pruneOut, keep: 2, minify: false }));
    const kept = readdirSync(join(pruneOut, "builds")).filter((name) => name !== "current").sort();
    eqn("keep: 2 leaves two builds", kept.length, 2);
    ok("the oldest build is pruned", !kept.includes(reports[0]!.id));
    ok("the newest build is kept", kept.includes(reports[2]!.id));
    eq("current names the newest build", readlinkSync(join(pruneOut, "current")), join("builds", reports[2]!.id));
  } finally {
    rmSync(pruneOut, { recursive: true, force: true });
  }
  done();
};

await main();
