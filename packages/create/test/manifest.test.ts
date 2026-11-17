// node-only
/**
 * @file The package.json the generator writes for each install mode, and the closure of the
 * packages light's own packages depend on.
 */
import { join, relative, sep } from "node:path";
import { dependencyClosure, findCheckout, manifestFor } from "../generate.ts";
import { KINDS } from "../kinds.ts";
import { done, eq, ok } from "@lightstart/test/assert.ts";

const root = findCheckout();
ok("the tests run from a checkout", root !== null);
if (root === null) {
  done();
  process.exit(1);
}

const web = KINDS.find((kind) => kind.name === "web");
ok("the web kind is in the table", web !== undefined);
if (web === undefined) {
  done();
  process.exit(1);
}

const target = join(root, "demo");
const light = relative(target, join(root, "packages", "light"));
const components = relative(target, join(root, "packages", "components"));

eq("the closure adds what components needs", dependencyClosure(root, ["@lightstart/components"]).join(","), "@lightstart/components,@lightstart/highlight,@lightstart/markdown");

for (const mode of ["link", "file", "npm"] as const) {
  const manifest = manifestFor(web, "demo", root, mode, target);
  eq(`${mode}: type module`, manifest.type, "module");
  eq(`${mode}: private`, String(manifest.private), "true");
  eq(`${mode}: the name`, manifest.name, "demo");
  eq(`${mode}: the scripts`, JSON.stringify(manifest.scripts), JSON.stringify(web.scripts));
  eq(`${mode}: light is a dependency`, manifest.dependencies["@lightstart/light"], mode === "npm" ? "^0.1.0" : `${mode}:${light}`);
  eq(`${mode}: components is a dependency`, manifest.dependencies["@lightstart/components"], mode === "npm" ? "^0.1.0" : `${mode}:${components}`);
  eq(`${mode}: app is a dependency`, manifest.dependencies["@lightstart/app"], mode === "npm" ? "^0.1.0" : `${mode}:${relative(target, join(root, "packages", "app"))}`);
  eq(`${mode}: router comes with the app`, manifest.dependencies["@lightstart/router"], mode === "npm" ? "^0.1.0" : `${mode}:${relative(target, join(root, "packages", "router"))}`);
  eq(`${mode}: markdown is in the closure`, manifest.dependencies["@lightstart/markdown"], mode === "npm" ? "^0.1.0" : `${mode}:${relative(target, join(root, "packages", "markdown"))}`);
  eq(`${mode}: highlight is in the closure`, manifest.dependencies["@lightstart/highlight"], mode === "npm" ? "^0.1.0" : `${mode}:${relative(target, join(root, "packages", "highlight"))}`);
  eq(`${mode}: the cli comes with the app`, manifest.dependencies["@lightstart/cli"], mode === "npm" ? "^0.1.0" : `${mode}:${relative(target, join(root, "packages", "cli"))}`);
  if (mode !== "npm") ok(`${mode}: light is linked relative to the project`, manifest.dependencies["@lightstart/light"]?.startsWith(`${mode}:..`) === true);
  ok(`${mode}: dev is a devDependency`, manifest.devDependencies["@lightstart/dev"] !== undefined);
  ok(`${mode}: build is a devDependency`, manifest.devDependencies["@lightstart/build"] !== undefined);
  ok(`${mode}: server is a devDependency`, manifest.devDependencies["@lightstart/server"] !== undefined);
  eq(`${mode}: a ranged devDependency is kept`, manifest.devDependencies["playwright"], "^1.58.2");
}

const elsewhere = join(sep, root.split(sep)[1] === "elsewhere" ? "other" : "elsewhere", "demo");
eq("a project sharing no folder with light links it absolutely", manifestFor(web, "demo", root, "link", elsewhere).dependencies["@lightstart/light"], `link:${join(root, "packages", "light")}`);

done();
