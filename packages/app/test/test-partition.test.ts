/**
 * @file How `light test` divides an app's named files: a browser test or a
 * file that is not a test goes to Chromium, and every other test goes to node.
 */

import { done, eq } from "@lightstart/test/assert.ts";
import { partitionTestFiles } from "../node/test-partition.ts";

const split = (files: string[]): string => {
  const { node, browser } = partitionTestFiles(files);
  return `${node.join(",")} | ${browser.join(",")}`;
};

eq("a plain test runs under node", split(["test/app.test.ts"]), "test/app.test.ts | ");
eq("a browser test runs in Chromium", split(["test/app.browser.test.ts"]), " | test/app.browser.test.ts");
eq("an e2e file keeps the browser runner", split(["test/smoke.e2e.ts"]), " | test/smoke.e2e.ts");
eq(
  "a mixed run keeps each file on its side",
  split(["test/app.test.ts", "test/app.browser.test.ts", "test/smoke.e2e.ts", "test/notes.test.js"]),
  "test/app.test.ts,test/notes.test.js | test/app.browser.test.ts,test/smoke.e2e.ts",
);
done();
