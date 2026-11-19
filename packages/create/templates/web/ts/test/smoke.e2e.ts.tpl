import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { latestBuild, openBuilt } from "@lightstart/app/web/test";
import routes from "../src/routes.ts";

const project = fileURLToPath(new URL("..", import.meta.url));
const cli = createRequire(import.meta.url).resolve("@lightstart/cli/bin/light.js");
const paths = Object.keys(routes).filter((path) => !path.includes(":") && !path.includes("*"));

let buildDir = "";

before(async () => {
  const built = spawnSync(process.execPath, ["--no-warnings", cli, "build"], { cwd: project, encoding: "utf8" });
  assert.equal(built.status, 0, built.stderr || built.stdout);
  buildDir = await latestBuild(project);
});

describe("the built app", () => {
  for (const path of paths) {
    it(`opens ${path} without an error`, async () => {
      const page = await openBuilt(buildDir, path);
      try {
        assert.deepEqual(page.errors, []);
        assert.deepEqual(page.failed, []);
        if (path === "/") assert.match(await page.text(), /This is the home route\./);
      } finally {
        await page.close();
      }
    });
  }
});
