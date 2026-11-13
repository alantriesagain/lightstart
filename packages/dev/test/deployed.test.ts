// node-only
/**
 * @file The `--build` preview over a `.deployed` fixture: `.deployed/current` names the newest
 * build and is served strictly, with no TypeScript, no rewriting and missing assets 404.
 */
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDeployedServer } from "../node/deployed.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const project = mkdtempSync(join(tmpdir(), "dev-deployed-"));
const deployed = join(project, ".deployed");
const build = join(deployed, "builds", "1");
mkdirSync(build, { recursive: true });
writeFileSync(join(build, "index.html"), "<html><body>the build</body></html>");
writeFileSync(join(build, "app.js"), 'import x from "@lightstart/light";\nexport const n = 1;');
writeFileSync(join(build, "style.css"), "body { color: red; }");
symlinkSync(join("builds", "1"), join(deployed, "current"), "dir");

const main = async (): Promise<void> => {
  const server = await createDeployedServer({ dir: join(deployed, "current") });
  const origin = `http://127.0.0.1:${server.port}`;
  try {
    const root = await fetch(`${origin}/`);
    eqn("the build's index answers the root", root.status, 200);
    eq("as it was built", await root.text(), "<html><body>the build</body></html>");

    const js = await fetch(`${origin}/app.js`);
    eq("a file keeps its bytes, importmap and all", await js.text(), 'import x from "@lightstart/light";\nexport const n = 1;');
    ok("served as JavaScript", (js.headers.get("content-type") ?? "").startsWith("text/javascript"));

    const css = await fetch(`${origin}/style.css`);
    eq("a static asset", css.headers.get("content-type") ?? "", "text/css; charset=utf-8");

    eqn("a missing asset is a 404", (await fetch(`${origin}/missing.css`)).status, 404);
    eqn("a missing TypeScript source is a 404 too", (await fetch(`${origin}/app.ts`)).status, 404);
    eq("an extensionless path answers the build's index", await (await fetch(`${origin}/some/route`)).text(), "<html><body>the build</body></html>");
  } finally {
    await server.close();
    rmSync(project, { recursive: true, force: true });
  }
  done();
};

await main();
