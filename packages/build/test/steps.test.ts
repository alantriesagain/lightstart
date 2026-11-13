/**
 * @file The build step list: add inserts before `write`, before/after/replace/remove act by name,
 * and an unknown name throws with the names it knows.
 */
import { BuildSteps } from "../extension.ts";
import type { BuildStep } from "../types.ts";
import { done, eq, ok, throws } from "@light/test/assert.ts";

const builtIn = ["page", "modules", "stylesheets", "public", "html", "write"];

const step = (name: string): BuildStep => ({ name, run: () => {} });

const fresh = (): BuildSteps => new BuildSteps(builtIn.map(step));

const joined = (steps: BuildSteps): string => steps.names().join(",");

const main = (): void => {
  const added = fresh();
  added.add(step("extra"));
  eq("add puts a step before write", joined(added), "page,modules,stylesheets,public,html,extra,write");

  const appended = fresh();
  appended.remove("write");
  appended.add(step("extra"));
  eq("add appends when write is gone", joined(appended), "page,modules,stylesheets,public,html,extra");

  const before = fresh();
  before.before("modules", step("pre"));
  eq("before inserts just before the name", joined(before), "page,pre,modules,stylesheets,public,html,write");

  const after = fresh();
  after.after("modules", step("post"));
  eq("after inserts just after the name", joined(after), "page,modules,post,stylesheets,public,html,write");

  const replaced = fresh();
  replaced.replace("html", step("render"));
  eq("replace keeps the place and changes the name", joined(replaced), "page,modules,stylesheets,public,render,write");

  const removed = fresh();
  removed.remove("public");
  eq("remove drops the name", joined(removed), "page,modules,stylesheets,html,write");

  eq("names is the built-in order", joined(fresh()), builtIn.join(","));
  ok("list answers the steps in order", fresh().list().map((entry) => entry.name).join(",") === builtIn.join(","));

  for (const method of ["before", "after", "replace"] as const) {
    throws(`${method} on an unknown name lists the known ones`, () => fresh()[method]("nope", step("x")), "Unknown build step \"nope\"; known steps: page, modules, stylesheets, public, html, write");
  }
  throws("remove on an unknown name lists the known ones", () => fresh().remove("nope"), "Unknown build step \"nope\"; known steps: page, modules, stylesheets, public, html, write");

  done();
};

main();
