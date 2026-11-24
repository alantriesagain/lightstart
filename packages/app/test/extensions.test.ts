/**
 * @file Slots and extensions: a slot keeps its items in order and withdraws
 * them; a run fills an extension's slots before the app's controllers start,
 * starts the extension's controllers after the app's, calls `connected`, adds
 * its routes, and undoes it all on stop in reverse; `off` and
 * `openApp({ extensions: false })` leave extensions out.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { defineApp } from "../index.ts";
import type { AppManifest } from "../manifest.ts";
import { defineExtension } from "../extensions.ts";
import { currentView, navigate } from "../run.ts";
import { defineSlot, resetSlotNames } from "../slots.ts";
import { openApp } from "../test/index.ts";

interface Block {
  id: string;
  order?: number;
}

const ids = (items: readonly { id: string }[]): string => items.map((item) => item.id).join(",");

const thrown = (fn: () => unknown): string => {
  try {
    fn();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

resetSlotNames();
const blocks = defineSlot<Block>("detail.blocks");
const withdrawB = blocks.fill({ id: "b", order: 2 });
blocks.fill({ id: "a", order: 1 });
blocks.fill({ id: "c", order: 2 });
eq("items sort by order, then by fill order", ids(blocks.items.value), "a,b,c");
const first = blocks.items.value[0];
eq("an app's own fill names no extension", String(first === undefined ? "missing" : blocks.extensionOf(first)), "null");
withdrawB();
eq("a withdraw takes its item out", ids(blocks.items.value), "a,c");
blocks.fill({ id: "x" }, "maps");
eq("an item with no order counts as 0", ids(blocks.items.value), "x,a,c");
blocks.clear("maps");
eq("clear withdraws one extension's items", ids(blocks.items.value), "a,c");
ok("a second slot with the same name is an error", thrown(() => defineSlot("detail.blocks")).includes("defined twice"));

resetSlotNames();
const tabs = defineSlot<Block>("bar.tabs");
const order: string[] = [];

const appController = {
  start(): void {
    order.push(`app sees ${ids(tabs.items.value)}`);
  },
  dispose(): void {
    order.push("app stops");
  },
};
const socialController = {
  start(): void {
    order.push("social starts");
  },
  dispose(): void {
    order.push("social stops");
  },
};

const social = defineExtension({
  name: "social",
  fills: [tabs.entry({ id: "going", order: 2 }), tabs.entry({ id: "people", order: 1 })],
  controllers: [socialController],
  routes: { "/going": { name: "going", view: "social-going" } },
  connected: () => {
    order.push("social connected");
  },
  disconnected: () => {
    order.push("social disconnected");
  },
});
const account = defineExtension({ name: "account", fills: [tabs.entry({ id: "you", order: 3 })] });

const manifest = (extensions = [social, account]): AppManifest => ({
  app: defineApp({ name: "extensions", host: "tui" }),
  models: [],
  controllers: [{ name: "main", controller: appController }],
  routes: { "/": { name: "home", view: "app-home" } },
  views: [],
  extensions,
});

const main = async (): Promise<void> => {
  const opened = await openApp(manifest());
  eq("the fills are there before the app's controllers start, and the extensions' start after", order.join(" | "), "app sees people,going,you | social starts | social connected");
  const filled = tabs.items.value[0];
  eq("a filled item names its extension", String(filled === undefined ? "missing" : tabs.extensionOf(filled)), "social");
  navigate("/going");
  eq("an extension's route joins the table", String(currentView.value), "social-going");
  order.length = 0;
  await opened.stop();
  eq("stop disconnects, stops the extension's controllers before the app's", order.join(" | "), "social disconnected | social stops | app stops");
  eq("stop withdraws the fills", ids(tabs.items.value), "");

  order.length = 0;
  const off = await openApp({ ...manifest(), app: defineApp({ name: "extensions", host: "tui", extensions: { off: ["social"] } }) });
  eq("off leaves an extension out", ids(tabs.items.value) + " " + order.join(" | "), "you app sees you");
  await off.stop();

  order.length = 0;
  const none = await openApp(manifest(), { extensions: false });
  eq("openApp({ extensions: false }) runs none", ids(tabs.items.value) + "|" + order.join(" | "), "|app sees ");
  await none.stop();

  const twice = defineExtension({ name: "social" });
  let duplicate = "";
  try {
    await openApp(manifest([social, twice]));
  } catch (error) {
    duplicate = error instanceof Error ? error.message : String(error);
  }
  ok("two extensions with one name is an error", duplicate.includes("Two extensions are named"));

  const clash = defineExtension({ name: "clash", routes: { "/": { name: "other", view: "x-home" } } });
  let route = "";
  try {
    await openApp(manifest([clash]));
  } catch (error) {
    route = error instanceof Error ? error.message : String(error);
  }
  ok("a route the app declares is an error naming the extension", route.includes("clash") && route.includes("already declared"));
  done();
};

await main();
