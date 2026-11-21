/**
 * @file How `light test` divides an app's named test files: a `*.browser.test.*`
 * file runs in headless Chromium as before, every other `*.test.*` file runs
 * under node, and a file that is neither (such as `*.e2e.*`) keeps the browser
 * runner. The app's extension loads light's markup host before the node files
 * so the generated manifest's views register without a browser.
 */

/** The files that run under node, and the files that run in headless Chromium. */
export interface TestPartition {
  /** The `*.test.*` files that are not `*.browser.test.*`. */
  node: string[];
  /** The `*.browser.test.*` files, and the files that are neither kind of test. */
  browser: string[];
}

/** @param {string} file */
const isTest = (file: string): boolean => /\.test\./.test(file);

/** @param {string} file */
const isBrowserTest = (file: string): boolean => /\.browser\.test\./.test(file);

/**
 * Split the files light was given: a `*.browser.test.*` file, or one that is
 * not a `*.test.*` file at all, goes to the browser runner; every other test
 * goes to node.
 * @param {readonly string[]} files
 * @returns {TestPartition}
 */
export const partitionTestFiles = (files: readonly string[]): TestPartition => {
  const node: string[] = [];
  const browser: string[] = [];
  for (const file of files) {
    if (isTest(file) && !isBrowserTest(file)) node.push(file);
    else browser.push(file);
  }
  return { node, browser };
};
