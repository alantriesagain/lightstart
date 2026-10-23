/**
 * @file @bootstrapp/light/test/run.js
 * Runs browser test files one page at a time in headless Chromium and reports
 * what each found. A runner page imports the file (whose `node:test` resolves
 * to the shims beside this module), runs it and publishes the result on
 * `window.testResults`; this loop opens the page, waits for that, and prints.
 * Any host can drive it: `runnerUrl(fileUrl)` is where the host serves its
 * runner page for a file.
 */

/** @import { WireResult, WireRun } from "./types.ts" */

const colors = {
  reset: "\x1b[0m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  gray: "\x1b[90m", bold: "\x1b[1m",
};

export const PLAYWRIGHT_HINT =
  "Browser tests need Playwright.\n  Install it where you are running from:  npm i -D playwright && npx playwright install chromium";

const loadChromium = async () => {
  try {
    return (await import("playwright")).chromium;
  } catch {
    return null;
  }
};

/**
 * @param {{ log: (msg: string) => void }} log
 * @param {(frame: string) => string} frame
 * @param {WireResult[]} [failures]
 */
const reportFailures = (log, frame, failures = []) => {
  for (const [index, failure] of failures.entries()) {
    const name = Array.isArray(failure.name) ? failure.name.join(" > ") : String(failure.name ?? "(unnamed)");
    log.log(`  ${colors.red}${index + 1})${colors.reset} ${name}`);
    for (const line of String(failure.error?.message ?? "").split("\n"))
      log.log(`     ${line.startsWith("+") ? colors.green : line.startsWith("-") ? colors.red : colors.gray}${line}${colors.reset}`);
    for (const stackFrame of (failure.error?.stack ?? []).slice(0, 6))
      log.log(`     ${colors.gray}${frame(stackFrame)}${colors.reset}`);
    log.log("");
  }
};

/**
 * Run every file and answer whether all of them passed. A file with no tests,
 * one that failed to load, or one whose page raised an error no test caught
 * counts as failed; so does a run with no tests at all.
 * @param {{
 *   files: Array<{ label: string, url: string }>,
 *   runnerUrl: (fileUrl: string) => string,
 *   headless?: boolean,
 *   timeoutMs?: number,
 *   log?: { log: (msg: string) => void, error: (msg: string) => void },
 *   frame?: (frame: string) => string,
 * }} options
 * @returns {Promise<boolean>}
 */
export const runFiles = async ({ files, runnerUrl, headless = true, timeoutMs = 420000, log = console, frame = (f) => f.replace(/^at\s+/, "at ") }) => {
  const chromium = await loadChromium();
  if (!chromium) {
    log.error(PLAYWRIGHT_HINT);
    return false;
  }
  const browser = await chromium.launch({ headless });
  const totals = { pass: 0, fail: 0, skip: 0, todo: 0, total: 0 };
  const KEYS = /** @type {(keyof typeof totals)[]} */ (["pass", "fail", "skip", "todo", "total"]);
  const fail = (/** @type {string} */ label, /** @type {string[]} */ lines) => {
    totals.fail += 1;
    log.log(`${colors.red}✗${colors.reset} ${colors.gray}${label}${colors.reset}`);
    for (const line of lines) log.log(`     ${colors.gray}${line}${colors.reset}`);
  };

  try {
    for (const file of files) {
      const page = await browser.newPage();
      /** @type {string[]} */
      const crashes = [];
      page.on("pageerror", (e) => { if (!/^ResizeObserver loop/.test(e.message)) crashes.push(e.message); });
      try {
        await page.goto(runnerUrl(file.url), { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => Boolean(globalThis.testResults), null, { timeout: timeoutMs });
        const results = /** @type {WireRun} */ (await page.evaluate(() => globalThis.testResults));
        const counts = results.counts ?? { pass: 0, fail: 0, skip: 0, todo: 0, total: 0 };
        for (const key of KEYS) totals[key] += counts[key] ?? 0;

        if (results.shimLoaded === false) { fail(file.label, ["node:test did not resolve through the runner page's importmap"]); continue; }
        if (results.loadError) { fail(file.label, [results.loadError.message, ...(results.loadError.stack ?? []).slice(0, 4).map(frame)]); continue; }
        if (counts.total === 0) { fail(`registered 0 tests  ${file.label}`, []); continue; }
        if (!counts.fail && crashes.length) { fail(file.label, [`the page raised ${crashes.length === 1 ? "an error" : `${crashes.length} errors`} no test accounted for`, ...crashes.slice(0, 3)]); continue; }

        const mark = counts.fail ? `${colors.red}✗` : `${colors.green}✓`;
        const skipped = counts.skip + counts.todo ? `  ${colors.yellow}${String(counts.skip + counts.todo).padStart(2)} skipped${colors.reset}` : "";
        log.log(`${mark}${colors.reset} ${String(counts.pass).padStart(4)} passed  ${String(counts.fail).padStart(3)} failed${skipped}  ${colors.gray}${file.label}${colors.reset}`);
        reportFailures(log, frame, results.failures);
      } catch (error) {
        fail(file.label, [error instanceof Error ? error.message : String(error), ...crashes.slice(0, 3)]);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  if (files.length > 0 && totals.total === 0) {
    log.error("The run executed 0 tests across all files; failing instead of reporting an empty green.");
    return false;
  }
  const skipped = totals.skip + totals.todo ? `, ${totals.skip + totals.todo} skipped` : "";
  log.log(totals.fail
    ? `\n${colors.red}${colors.bold}${totals.fail} failed${colors.reset}, ${totals.pass} passed${skipped}, ${totals.total} total\n`
    : `\n${colors.green}${colors.bold}${totals.pass} passed${colors.reset}${skipped}, ${totals.total} total\n`);
  return totals.fail === 0;
};
