// node-only
/**
 * @file Template copying: `__NAME__` and `__TITLE__` replaced in the text, and a `.tpl` suffix
 * dropped from the written name.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyTemplate, replaceTokens } from "../generate.ts";
import { titleOf } from "../kinds.ts";
import { done, eq, ok } from "@light/test/assert.ts";

eq("a token is replaced", replaceTokens("hi __NAME__, __TITLE__", "my-app", "My App"), "hi my-app, My App");
eq("a hyphenated name titles", titleOf("my-app"), "My App");
eq("an underscored name titles", titleOf("my_package"), "My Package");

const base = mkdtempSync(join(tmpdir(), "create-template-"));
try {
  const template = join(base, "template");
  const target = join(base, "target");
  mkdirSync(join(template, "src"), { recursive: true });
  writeFileSync(join(template, "index.html.tpl"), "<title>__TITLE__</title>");
  writeFileSync(join(template, "src", "main.ts.tpl"), "// __NAME__\n");
  writeFileSync(join(template, "README.md"), "# __NAME__\n");
  const written = copyTemplate(template, target, "my-app", "My App");
  eq("the .tpl suffix is dropped", written.join(","), "README.md,index.html,src/main.ts");
  eq("the page gets the title", readFileSync(join(target, "index.html"), "utf8"), "<title>My App</title>");
  eq("the source gets the name", readFileSync(join(target, "src", "main.ts"), "utf8"), "// my-app\n");
  eq("a plain name is kept", readFileSync(join(target, "README.md"), "utf8"), "# my-app\n");
  ok("no .tpl is written", !written.some((file) => file.endsWith(".tpl")));
} finally {
  rmSync(base, { recursive: true, force: true });
}

done();
