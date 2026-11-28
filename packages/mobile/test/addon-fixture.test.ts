// node-only
/**
 * @file `addonFixture`: the temp app copies the fixture without its
 * `node_modules`, `.light` and `.deployed`, links each declared `@lightstart`
 * package as resolved from the caller, runs the CLI it resolved the same way,
 * and names a declared package the caller cannot resolve.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { addonFixture } from "../node/addon-fixture.ts";

const fixture = (deps: Record<string, string>): string => {
  const dir = mkdtempSync(join(tmpdir(), "light-mobile-fixture-src-"));
  writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "fixture", private: true, type: "module", dependencies: deps }));
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src", "app.js"), "export default {};\n");
  mkdirSync(join(dir, "node_modules", "stale"), { recursive: true });
  mkdirSync(join(dir, ".light"));
  writeFileSync(join(dir, ".light", "app.js"), "stale\n");
  return dir;
};

const thrown = (fn: () => unknown): string => {
  try {
    fn();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const source = fixture({ "@lightstart/light": "workspace:*", "@lightstart/cli": "workspace:*", "left-alone": "1.0.0" });
const app = addonFixture(source, import.meta.url, "light-mobile-fixture");
try {
  ok("the sources are copied", existsSync(join(app.project, "src", "app.js")));
  ok("the fixture's own node_modules are left behind", !existsSync(join(app.project, "node_modules", "stale")));
  ok("its .light is left behind", !existsSync(join(app.project, ".light")));
  const expected = dirname(createRequire(import.meta.url).resolve("@lightstart/light/package.json"));
  eq("a declared package links to the caller's copy", realpathSync(join(app.project, "node_modules", "@lightstart", "light")), realpathSync(expected));
  ok("the CLI is linked as declared", existsSync(join(app.project, "node_modules", "@lightstart", "cli", "bin", "light.js")));
  ok("a package outside the scope is not linked", !existsSync(join(app.project, "node_modules", "left-alone")));
  const help = app.run(["--help"], { timeout: 60_000 });
  eqn("the CLI runs in the app", help.status, 0);
  ok("and answers its usage", help.output.includes("light"));
  eq("the fixture's package.json is the copy's", readFileSync(join(app.project, "package.json"), "utf8"), readFileSync(join(source, "package.json"), "utf8"));
} finally {
  app.remove();
}
ok("remove takes the app away", !existsSync(app.project));

const missing = fixture({ "@lightstart/no-such-package": "workspace:*" });
const message = thrown(() => addonFixture(missing, import.meta.url, "light-mobile-fixture-missing"));
ok("a declared package the caller cannot resolve is an error naming it", message.includes("@lightstart/no-such-package") && message.includes("devDependencies"));

rmSync(source, { recursive: true, force: true });
rmSync(missing, { recursive: true, force: true });
done();
