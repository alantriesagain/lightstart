/**
 * @file @bootstrapp/light/test/page.js
 * The runner page: an importmap, the `node:test` handshake, the test file,
 * the harness, and the result published on `window.testResults` for the loop
 * in `run.js` to read. `prelude` is what a host runs before the file (a boot).
 */

/**
 * @param {{ file: string, importmap: Record<string, string>, harnessUrl: string, reportUrl: string, prelude?: string }} options
 */
export const runnerPage = ({ file, importmap, harnessUrl, reportUrl, prelude = "" }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Test runner</title>
  <script type="importmap">${JSON.stringify({ imports: importmap })}</script>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; padding: 20px; background: #1a1a1a; color: #e1e1e1; margin: 0; }
    pre { margin: 4px 0; white-space: pre-wrap; }
    .pass { color: #6c6; } .fail { color: #f66; } .skip { color: #cc6; } .info { color: #999; }
  </style>
</head>
<body>
  <div id="log"></div>
  <script type="module">
    const filePath = ${JSON.stringify(file)};
    const out = document.getElementById("log");
    const log = (text, kind = "info") => { const pre = document.createElement("pre"); pre.className = kind; pre.textContent = text; out.append(pre); };
    const publish = (results) => { window.testResults = results; };
    try {
${prelude}
      const harness = await import(${JSON.stringify(harnessUrl)});
      const { toWireFormat, loadFailure } = await import(${JSON.stringify(reportUrl)});
      let shimLoaded = false;
      try { await import("node:test"); shimLoaded = globalThis.__NODE_TEST_SHIM__ === true; } catch { shimLoaded = false; }
      if (!shimLoaded) {
        log("node:test did not resolve through the runner importmap", "fail");
        publish(loadFailure(filePath, new Error("node:test did not resolve through the runner importmap"), { shimLoaded: false }));
      } else {
        log("Running: " + filePath);
        harness.reset();
        let loadError = null;
        try { await import(filePath); } catch (error) { loadError = error; }
        if (loadError) {
          log("Failed to load: " + loadError.message, "fail");
          publish(loadFailure(filePath, loadError));
        } else {
          const wire = toWireFormat(await harness.run(), { file: filePath, shimLoaded: true });
          for (const result of wire.tests) {
            const name = result.name.join(" > ");
            log(result.status === "pass" ? "✓ " + name : result.status === "fail" ? "✗ " + name : "- " + name + " (" + result.status + ")", result.status === "pass" ? "pass" : result.status === "fail" ? "fail" : "skip");
          }
          log("Passed: " + wire.counts.pass + "  Failed: " + wire.counts.fail + "  Total: " + wire.counts.total);
          for (const failure of wire.failures) {
            log(failure.name.join(" > "), "fail");
            log("  " + failure.error.message, "fail");
            for (const line of failure.error.diff ?? []) log("  " + line, line.startsWith("+") ? "fail" : "info");
          }
          publish(wire);
        }
      }
    } catch (error) {
      log("Error: " + error.message, "fail");
      publish({ shimLoaded: false, file: filePath, loadError: { name: error.name, message: error.message, stack: [] }, durationMs: 0, counts: { pass: 0, fail: 1, skip: 0, todo: 0, total: 1, suites: 0 }, tests: [], failures: [] });
    }
  </script>
</body>
</html>
`;
