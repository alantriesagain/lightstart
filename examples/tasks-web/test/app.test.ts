/**
 * @file The app opened in headless Chromium with the list Work: a task added through the form is
 * listed, the lists page counts it, the activity page shows what the page did (from its memory
 * store), and opening a list from the lists page comes back to its tasks.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { openPage } from "@lightstart/app/web/test";
import manifest from "../.light/app.ts";

describe("tasks", () => {
  it("adds a task, counts it on the lists page and logs the activity", async () => {
    const page = await openPage(manifest, { args: { list: "Work" } });
    try {
      assert.ok((await page.shows("Work")).includes("Work"), "the default list is open");

      const tasks = await page.find("tasks-page");
      const field = tasks.querySelector("input[name=task]");
      assert.ok(field instanceof HTMLInputElement, "the tasks page has its field");
      field.value = "write the adapter";
      const form = tasks.querySelector("form");
      assert.ok(form instanceof HTMLFormElement, "and its form");
      form.requestSubmit();
      assert.ok((await page.shows("write the adapter")).includes("write the adapter"), "the task is listed");

      await page.navigate("/lists");
      assert.ok((await page.shows("0/1 done")).includes("0/1 done"), "the lists page counts it");

      await page.navigate("/activity");
      const activity = await page.shows("added write the adapter");
      assert.ok(activity.includes("added write the adapter") && activity.includes("made the list Work"), activity);

      await page.navigate("/lists");
      const lists = await page.find("lists-page");
      const open = lists.querySelector("li lc-button");
      assert.ok(open instanceof HTMLElement, "a list has its button");
      open.click();
      assert.ok((await page.shows("write the adapter")).includes("write the adapter"), "opening it shows its tasks again");
    } finally {
      await page.stop();
    }
  });

  it("switches to Portuguese", async () => {
    const page = await openPage(manifest, { args: { list: "Work" } });
    try {
      const switcher = await page.find("lc-language-switcher");
      const select = switcher.querySelector("select");
      assert.ok(select instanceof HTMLSelectElement, "the switcher has its select");
      select.value = "pt";
      select.dispatchEvent(new Event("change", { bubbles: true }));
      const text = await page.shows("Tarefas");
      assert.ok(text.includes("Tarefas"), "the page is in Portuguese");
    } finally {
      await page.stop();
    }
  });
});
