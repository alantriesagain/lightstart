import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setLanguage } from "@lightstart/i18n";
import { openPage } from "@lightstart/app/web/test";
import manifest from "../.light/app.js";

describe("URLs per language", () => {
  it("keeps the locale while navigating and follows setLanguage", async () => {
    const page = await openPage(manifest, { path: "/pt/about" });
    try {
      assert.equal(page.run.router?.path, "/pt/about");
      assert.ok((await page.shows("Sobre o fixture")).includes("Sobre o fixture"));
      assert.equal((await page.find("#home")).getAttribute("href"), "/pt");
      assert.equal((await page.find("#about")).getAttribute("href"), "/pt/about");
      assert.equal((await page.find("#spanish")).getAttribute("href"), "/es/about", "an explicit locale stays as written");
      await page.navigate("/");
      assert.equal(page.run.router?.path, "/pt");
      await page.shows("Bem-vindo");
      await setLanguage("es");
      await page.settle();
      assert.equal(page.run.router?.path, "/es");
      await page.shows("Bienvenido");
      assert.equal((await page.find("#about")).getAttribute("href"), "/es/about");
    } finally {
      await page.stop();
    }
  });
});
