import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { bootApp, disposeApp, until } from "@bootstrapp/test/app.js";
import presets from "@lightstart/light/theme/presets.js";

describe("the theming and skins pages", () => {
  let app;

  before(async () => {
    app = await bootApp("/skins");
    await until(() => app.doc.querySelectorAll("docs-skins showcase-sink").length === presets.length);
    await until(() => app.doc.querySelectorAll("docs-skins [data-lc-skin]").length === presets.length);
  });

  after(() => disposeApp(app));

  it("lines up one sink per preset, each wearing its own shape roles", async () => {
    const radius = (name) => app.win.getComputedStyle(app.doc.querySelector(`[data-lc-skin="${name}"]`)).getPropertyValue("--radius-field").trim();
    await until(() => radius("daisy") !== "" && radius("daisy") !== radius("neobrutalist"));
    assert.notEqual(radius("daisy"), radius("gruvbox-dark"));
    const chrome = app.win.getComputedStyle(app.doc.querySelector(".shell-header")).getPropertyValue("--radius-field").trim();
    assert.equal(chrome, radius("default"));
  });

  it("puts the token editor beside a live catalogue on the theming page", async () => {
    app.$APP.Router.go("/theming");
    await until(() => app.doc.querySelector("docs-theming showcase-theme-generator showcase-theme-editor") !== null);
    await until(() => app.doc.querySelectorAll("docs-theming .catalogue-card").length > 0);
    assert.deepEqual(app.errors, []);
  });
});
