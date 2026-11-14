import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

const waitFor = async (predicate, label, timeout = 5000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${label}`);
};

const importmap = () => document.querySelector('script[type="importmap"]')?.textContent ?? '{"imports":{}}';

const frameDocument = () => `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy" content="style-src 'self'; script-src 'self' 'unsafe-inline'">
  <script type="importmap">${importmap()}</script>
  <script>
    window.__violations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      window.__violations.push({ directive: event.effectiveDirective, blocked: event.blockedURI });
    });
  </script>
  <link rel="stylesheet" href="/display/icon.css">
</head>
<body>
  <div id="root"></div>
  <script type="module">
    (async () => {
      try {
        const { html, render } = await import("@lightstart/light/html");
        const { default: View } = await import("@lightstart/light");
        const { default: iconDef } = await import("@lightstart/components/display/icon.js");
        const { applyTheme } = await import("@lightstart/light/theme");

        View.define("lc-icon", iconDef);
        render(html\`
          <div id="bound" style=\${"width: 37px"}></div>
          <div id="static" style="height: 41px"></div>
          <lc-icon size="23"></lc-icon>
        \`, document.getElementById("root"));
        applyTheme({ color: { primary: "#123456" } });

        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const bound = getComputedStyle(document.getElementById("bound"));
        const fixed = getComputedStyle(document.getElementById("static"));
        const icon = getComputedStyle(document.querySelector("lc-icon"));
        window.__result = {
          width: bound.width,
          height: fixed.height,
          iconWidth: icon.width,
          primary: getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim(),
          violations: window.__violations.slice(),
        };
      } catch (error) {
        window.__error = String(error && error.stack || error);
      }
    })();
  <\/script>
</body>
</html>`;

describe("inline style under style-src 'self'", () => {
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  frame.srcdoc = frameDocument();

  after(() => frame.remove());

  it("renders bindings, static styles, an icon size and a theme with no violation", async () => {
    document.body.append(frame);
    const win = frame.contentWindow;
    const result = await waitFor(() => win.__result || win.__error, "the frame to finish");
    assert.equal(typeof result, "object", String(result));
    assert.equal(result.width, "37px", "a style binding went through the CSSOM");
    assert.equal(result.height, "41px", "a static style applied once, through the CSSOM");
    assert.equal(result.iconWidth, "23px", "a component's own style write went through the CSSOM");
    assert.equal(result.primary.toLowerCase(), "#123456", "the theme sheet was adopted");
    assert.deepEqual(result.violations, [], "no securitypolicyviolation fired");
  });
});
