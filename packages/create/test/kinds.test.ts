// node-only
/**
 * @file The kind table: four kinds, a sentence each, and the web kind's light packages, scripts
 * and devDependencies.
 */
import { KINDS, kindByName } from "../kinds.ts";
import { done, eq, ok } from "@lightstart/test/assert.ts";

eq("four kinds", KINDS.map((kind) => kind.name).join(","), "web,tui,desktop,package");
ok("every kind has a sentence", KINDS.every((kind) => kind.description.length > 0));
ok("every kind has scripts", KINDS.every((kind) => Object.keys(kind.scripts).length > 0));
ok("names are unique", new Set(KINDS.map((kind) => kind.name)).size === KINDS.length);

const web = kindByName("web");
ok("web is in the table", web !== undefined);
if (web !== undefined) {
  eq("web depends on light, components and the app layer", web.packages.join(","), "@lightstart/light,@lightstart/components,@lightstart/app");
  eq("web's scripts", Object.keys(web.scripts).join(","), "dev,build,test,check,lint,typecheck,verify");
  eq("verify runs light verify", web.scripts.verify, "light verify");
  eq("dev serves with a watch", web.scripts.dev, "light serve --watch");
  eq("build runs light build", web.scripts.build, "light build");
  eq("test names the browser tests", web.scripts.test, "light test test/*.test.*");
  eq("web has a JavaScript and a TypeScript variant", web.languages?.join(",") ?? "", "js,ts");
  eq("check runs light check", web.scripts.check, "light check");
  ok("web declares the cli", Object.hasOwn(web.devDependencies, "@lightstart/cli"));
  ok("web declares playwright", Object.hasOwn(web.devDependencies, "playwright"));
}

const tui = kindByName("tui");
ok("tui is in the table", tui !== undefined);
if (tui !== undefined) {
  eq("tui depends on light and the app layer", tui.packages.join(","), "@lightstart/light,@lightstart/app");
  eq("tui's scripts", Object.keys(tui.scripts).join(","), "dev,test,build,check,lint,typecheck,verify");
  eq("dev runs the app", tui.scripts.dev, "light run");
  eq("test runs light test under node and natively", tui.scripts.test, "light test");
  eq("build runs light build", tui.scripts.build, "light build");
  eq("check runs light check", tui.scripts.check, "light check");
  ok("tui declares native", Object.hasOwn(tui.devDependencies, "@lightstart/native"));
  ok("tui declares build", Object.hasOwn(tui.devDependencies, "@lightstart/build"));
  eq("tui's native entry is the generated one", JSON.stringify(tui.manifest?.native), JSON.stringify({ entry: ".light/main.ts", binary: "__NAME__", prepare: ["light app"] }));
}

eq("an unknown kind is absent", String(kindByName("nope")), "undefined");
done();
