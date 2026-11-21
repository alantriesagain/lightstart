/**
 * @file `light test` extended by the app: generate the manifest before the
 * command picks its files, so a browser test can import `../.light/main.ts`,
 * or `../.light/main.js` for a JavaScript app. In a project with `src/app.ts`
 * or `src/app.js`, the named files are split: `*.browser.test.*` runs in
 * headless Chromium as before, every other `*.test.*` runs under node with
 * light's markup host loaded first, and both parts are reported.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/light/cli/extensions.ts";
import type { TestInput } from "@lightstart/light/cli/extensions.ts";
import { RUNNER_PATH } from "@lightstart/light/test/serve.js";
import { generate } from "../../node/generate.ts";
import { partitionTestFiles } from "../../node/test-partition.ts";

const isApp = (dir: string): boolean => existsSync(join(dir, "src/app.ts")) || existsSync(join(dir, "src/app.js"));

const runUnderNode = (files: readonly string[], projectDir: string): Promise<boolean> =>
  new Promise((settle, fail) => {
    const child = spawn(process.execPath, ["--import", import.meta.resolve("@lightstart/light/markup"), "--test", ...files], { cwd: projectDir, stdio: "inherit" });
    child.once("error", fail);
    child.once("close", (code) => settle(code === 0));
  });

const runInChromium = async (files: readonly string[], input: TestInput): Promise<boolean> => {
  const { server, url } = await input.serve(input.root);
  try {
    return await input.runFiles({
      files: files.map((file) => {
        const rel = relative(input.root, file).split(sep).join("/");
        return { label: rel, url: `/${rel}` };
      }),
      runnerUrl: (fileUrl) => `${url}${RUNNER_PATH}?file=${encodeURIComponent(fileUrl)}`,
      headless: input.headless,
      timeoutMs: input.timeoutMs,
    });
  } finally {
    server.close();
  }
};

const report = (part: string, count: number, passed: boolean): void => {
  console.log(`${part}: ${passed ? "passed" : "failed"} (${String(count)} file${count === 1 ? "" : "s"})`);
};

export default defineExtension("test", {
  async setup(ctx, args, api) {
    await generate(ctx.projectDir);
    const files = args.files ?? [];
    if (!isApp(ctx.projectDir) || files.length === 0) return;
    api.run(async (input) => {
      const { node, browser } = partitionTestFiles(input.files);
      let passed = true;
      if (node.length > 0) {
        const nodePassed = await runUnderNode(node, input.projectDir);
        report("node", node.length, nodePassed);
        passed = passed && nodePassed;
      }
      if (browser.length > 0) {
        const browserPassed = await runInChromium(browser, input);
        report("browser", browser.length, browserPassed);
        passed = passed && browserPassed;
      }
      return passed;
    });
  },
});
