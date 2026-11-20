/**
 * @file The test runner's static server: a project's files, then a file under its `public/`
 * folder at the root, with the project's file winning when both have the path, and the same
 * refusal of a path that leaves the folder.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { serve } from "./serve.js";

test("public files are served at the root, after the project's own", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "light-serve-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = path.join(dir, "project");
  mkdirSync(path.join(root, "public"), { recursive: true });
  writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "fixture", type: "module" }));
  writeFileSync(path.join(root, "style.css"), "#app { color: red; }\n");
  writeFileSync(path.join(root, "public", "style.css"), "#app { color: blue; }\n");
  writeFileSync(path.join(root, "public", "profile.jpeg"), "jpeg-bytes\n");
  writeFileSync(path.join(dir, "secret.txt"), "outside\n");

  const { server, url } = await serve(root);
  t.after(() => server.close());

  const image = await fetch(`${url}/profile.jpeg`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/jpeg");
  assert.equal(await image.text(), "jpeg-bytes\n");

  const both = await fetch(`${url}/style.css`);
  assert.equal(await both.text(), "#app { color: red; }\n");

  assert.equal((await fetch(`${url}/profile.png`)).status, 404);
  assert.equal((await fetch(`${url}/%2e%2e/secret.txt`)).status, 404);
});
