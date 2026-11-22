/**
 * @file The manifest an app and `definePwa` answer: the app's name and title
 * fill the defaults, the base goes before every path, and the fields the
 * config writes are kept.
 */

import { done, eq } from "@lightstart/test/assert.ts";
import { manifestOf } from "../manifest.ts";

const app = { name: "budget", title: "Budget", base: "/app" };

const defaults = manifestOf(app, {});
eq("the name defaults to the app's title", defaults.name, "Budget");
eq("the short name defaults to the app's name", defaults.short_name, "budget");
eq("the display defaults to standalone", defaults.display, "standalone");
eq("the start url is the app's base with its slash", defaults.start_url, "/app/");
eq("the scope is the worker's: the base with its slash, so /appx is outside it", defaults.scope, "/app/");
eq("an unnamed field stays out", JSON.stringify(defaults), '{"name":"Budget","short_name":"budget","display":"standalone","start_url":"/app/","scope":"/app/"}');

const root = manifestOf({ name: "budget", base: "" }, {});
eq("at the root the start url is a slash", root.start_url, "/");
eq("at the root the scope is a slash", root.scope, "/");
eq("without a title the name is the app's", root.name, "budget");

const explicit = manifestOf(app, {
  name: "Spending",
  short_name: "Spend",
  description: "Where the money goes",
  icons: [{ src: "/icons/app.png", sizes: "512x512", type: "image/png", purpose: "maskable" }],
  theme_color: "#123456",
  background_color: "#ffffff",
  display: "fullscreen",
  start_url: "/home",
  scope: "/",
  shortcuts: [{ name: "Add", url: "/add", icons: [{ src: "/icons/add.png", sizes: "96x96" }] }],
  screenshots: [{ src: "/shots/home.png", sizes: "1280x720", type: "image/png", form_factor: "wide", label: "Home" }],
  categories: ["finance", "productivity"],
});
eq("an explicit name is kept", explicit.name, "Spending");
eq("an explicit short name is kept", explicit.short_name, "Spend");
eq("the base is put before an icon", String(explicit.icons?.[0]?.src), "/app/icons/app.png");
eq("the base is put before an explicit start url", explicit.start_url, "/app/home");
eq("the base is put before an explicit scope", explicit.scope, "/app/");
eq("the theme colour is kept", String(explicit.theme_color), "#123456");
eq("the background colour is kept", String(explicit.background_color), "#ffffff");
eq("an explicit display is kept", explicit.display, "fullscreen");
eq("a shortcut url takes the base", String(explicit.shortcuts?.[0]?.url), "/app/add");
eq("a shortcut icon takes the base", String(explicit.shortcuts?.[0]?.icons?.[0]?.src), "/app/icons/add.png");
eq("a screenshot takes the base", String(explicit.screenshots?.[0]?.src), "/app/shots/home.png");
eq("the categories are kept", (explicit.categories ?? []).join(","), "finance,productivity");
eq("the icon purpose is kept", String(explicit.icons?.[0]?.purpose), "maskable");

done();
