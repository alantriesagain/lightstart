import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { openPage } from "@lightstart/app/web/test";
import { navigate } from "@lightstart/app/web";
import manifest from "../.light/app.ts";
import presets from "@lightstart/light/theme/presets.js";
import { until, watchErrors } from "./light-page.js";

describe("the theming and skins pages", () => {
  let page;
  let raised;

  before(async () => {
    raised = watchErrors();
    page = await openPage(manifest, { path: "/skins" });
    await until(() => document.querySelectorAll("docs-skins showcase-sink").length === presets.length);
    await until(() => document.querySelectorAll("docs-skins [data-lc-skin]").length === presets.length);
  });

  after(async () => {
    await page.stop();
    raised.stop();
  });

  it("lines up one sink per preset, each wearing its own shape roles", async () => {
    const radius = (name) => window.getComputedStyle(document.querySelector(`[data-lc-skin="${name}"]`)).getPropertyValue("--radius-field").trim();
    await until(() => radius("daisy") !== "" && radius("daisy") !== radius("neobrutalist"));
    assert.notEqual(radius("daisy"), radius("gruvbox-dark"));
    const chrome = window.getComputedStyle(document.querySelector(".shell-header")).getPropertyValue("--radius-field").trim();
    assert.equal(chrome, radius("default"));
  });

  it("puts the token editor beside a live catalogue on the theming page", async () => {
    navigate("/theming");
    await until(() => document.querySelector("docs-theming showcase-theme-generator showcase-theme-editor") !== null);
    await until(() => document.querySelectorAll("docs-theming .catalogue-card").length > 0);
    assert.deepEqual(raised.errors, []);
  });
});
