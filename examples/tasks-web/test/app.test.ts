/**
 * @file The app in headless Chromium: the root view mounts over IndexedDB with its list open, a
 * task added through the form is listed, the lists page counts it, the activity page shows what the
 * page did (from its memory store), and opening a list from the lists page comes back to its tasks.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { navigate } from "@lightstart/app/web";
import "../.light/main.ts";

type Updating = HTMLElement & { $requestUpdate(): Promise<void> };

const settle = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** The element `selector` finds once it is there. */
const found = async (selector: string): Promise<Updating> => {
  for (let i = 0; i < 100; i++) {
    const element = document.querySelector(selector);
    if (element !== null) return element as Updating;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("no " + selector);
};

/** The page's text once `wanted` shows in it. */
const shows = async (wanted: string): Promise<string> => {
  let shown = "";
  for (let i = 0; i < 100; i++) {
    shown = document.body.textContent ?? "";
    if (shown.includes(wanted)) return shown;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return shown;
};

describe("tasks", () => {
  it("adds a task, counts it on the lists page and logs the activity", async () => {
    const root = await found("app-root");
    // The test page's own path is no route of the app's: go to the first one.
    navigate("/");
    assert.ok((await shows("Inbox")).includes("Inbox"), "the default list is open");

    const page = await found("tasks-page");
    await page.$requestUpdate();
    const field = page.querySelector("input[name=task]");
    assert.ok(field instanceof HTMLInputElement, "the tasks page has its field");
    field.value = "write the adapter";
    const form = page.querySelector("form");
    assert.ok(form instanceof HTMLFormElement, "and its form");
    form.requestSubmit();
    await settle();
    assert.ok((await shows("write the adapter")).includes("write the adapter"), "the task is listed");

    navigate("/lists");
    assert.ok((await shows("0/1 done")).includes("0/1 done"), "the lists page counts it");

    navigate("/activity");
    const activity = await shows("added write the adapter");
    assert.ok(activity.includes("added write the adapter") && activity.includes("made the list Inbox"), activity);

    navigate("/lists");
    const lists = await found("lists-page");
    await lists.$requestUpdate();
    const open = lists.querySelector("li lc-button");
    assert.ok(open instanceof HTMLElement, "a list has its button");
    open.click();
    assert.ok((await shows("write the adapter")).includes("write the adapter"), "opening it shows its tasks again");
    await root.$requestUpdate();
  });
});
