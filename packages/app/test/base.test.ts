/**
 * @file The app's deploy base: `url` with and without a path, its trailing
 * slash, an explicit `base`, and `base: "/"` meaning the root.
 */

import { done, eq } from "@lightstart/test/assert.ts";
import { appBase, appUrl, setAppBase } from "../base.ts";

eq("a url without a path has no base", appBase({ url: "https://lightstart.dev" }), "");
eq("a url with a path is the base", appBase({ url: "https://user.github.io/budget" }), "/budget");
eq("a trailing slash on the url is dropped", appBase({ url: "https://user.github.io/budget/" }), "/budget");
eq("a base without a leading slash gets one", appBase({ base: "budget" }), "/budget");
eq("a base with a trailing slash drops it", appBase({ base: "/budget/" }), "/budget");
eq("base overrides the url's path", appBase({ base: "/docs", url: "https://user.github.io/budget" }), "/docs");
eq("base / is no base", appBase({ base: "/" }), "");
eq("no url and no base is no base", appBase({}), "");
setAppBase("/budget");
eq("appUrl puts the base before a root-relative path", appUrl("/rates.json"), "/budget/rates.json");
eq("appUrl leaves an absolute URL alone", appUrl("https://example.com/x"), "https://example.com/x");
setAppBase("");
eq("appUrl is unchanged with no base", appUrl("/rates.json"), "/rates.json");
done();
