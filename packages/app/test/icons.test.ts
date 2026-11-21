// node-only
/**
 * @file The icon scanner: the literal names a source writes, the variants and
 * sizes an element asks for, the names a module declares, and the bindings
 * whose name is an expression.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { ownIcons, scanIcons, svgProblems } from "../node/icons.ts";

const source = `const view = html\`
  <lc-icon name="house" solid bold size="18"></lc-icon>
  <lc-button icon="menu"></lc-button>
  <lc-icon name=\${name}></lc-icon>
\`;
const field = { icon: "search" };
const other = { iconName: "copy" };
export default { icons: ["check", 3, "circle-x"] };`;

const scan = scanIcons(source);

eq("the element name, the icon attributes and the declared names", scan.names.join(","), "house,menu,search,copy,check,circle-x");
eq("a solid element is a solid name", scan.solid.join(","), "house");
eq("a bold element is a bold name", scan.bold.join(","), "house");
eq("a numeric size is a size", scan.sizes.join(","), "18");
eq("the declared names are kept apart", scan.declared.join(","), "check,circle-x");
eqn("one dynamic binding is found", scan.dynamic.length, 1);
eqn("with its line", scan.dynamic[0]?.line ?? 0, 4);
eq("and its expression", scan.dynamic[0]?.expr, "name");

const data = scanIcons('export default [{ icon: "terminal" }, { icon: "house" }];\nconst view = `<lc-icon name="house"></lc-icon>`;');
eq("a name seen only as an icon property is kept apart", data.properties.join(","), "terminal");
eq("and still among the names", data.names.join(","), "house,terminal");

const staticField = scanIcons('class Accounts extends View {\n  static icons = ["landmark", "credit-card"];\n}');
eq("a class's static icons field declares names too", staticField.declared.join(","), "landmark,credit-card");

const commentOnly = scanIcons('// <lc-icon name="ghost"></lc-icon>\n/* icon: "phantom" */\nconst view = `<p>Hi</p>`;');
eqn("a name in a comment is not counted", commentOnly.names.length, 0);

const invalid = scanIcons('<lc-icon name="House"></lc-icon><lc-icon name="2fa"></lc-icon>');
eqn("a name that is not lower-case kebab is left out", invalid.names.length, 0);

const dynamicOnly = scanIcons('const view = `<lc-button icon=${chosen}></lc-button>`;');
eqn("an expression attribute is dynamic", dynamicOnly.dynamic.length, 1);
eqn("and is not a name", dynamicOnly.names.length, 0);

const closed = scanIcons('<lc-icon name="x"></lc-icon>');
ok("the closing tag adds nothing", closed.names.join(",") === "x");

const project = mkdtempSync(join(tmpdir(), "light-app-own-icons-"));
try {
  mkdirSync(join(project, "icons"));
  writeFileSync(
    join(project, "icons", "brand-mark.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><!-- a mark -->\n  <circle cx="16" cy="16" r="12" />\n</svg>\n',
  );
  writeFileSync(join(project, "icons", "wide.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12"><path d="M0 0" /></svg>\n');
  writeFileSync(join(project, "icons", "square.svg"), '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>\n');
  writeFileSync(
    join(project, "icons", "stroked.svg"),
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round'><path d=\"M4 12h16\" /></svg>\n",
  );
  writeFileSync(join(project, "icons", "Bad.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" />\n');
  const own = ownIcons(project);
  eq("own icons are named by their file", own.map((item) => item.name).join(","), "brand-mark,square,stroked,wide");
  eq(
    "the root's paint attributes wrap the body, so a stroked icon stays stroked in a mask",
    own[2]?.entry.body,
    '<g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12h16" /></g>',
  );
  eq("the viewBox gives the width and height", `${String(own[0]?.entry.width)},${String(own[0]?.entry.height)}`, "32,32");
  ok("the body is the markup inside the root, without comments", own[0]?.entry.body === '<circle cx="16" cy="16" r="12" />');
  eq("the file is relative to the project", own[0]?.file, "icons/brand-mark.svg");
  eq("the width and height attributes size an icon without a viewBox", `${String(own[3]?.entry.width)},${String(own[3]?.entry.height)}`, "16,12");
  eq("an icon with no size is 24", `${String(own[1]?.entry.width)},${String(own[1]?.entry.height)}`, "24,24");
  ok("a name that is not an icon name is left out", !own.some((item) => item.name === "Bad"));
} finally {
  rmSync(project, { recursive: true, force: true });
}

eq("a clean SVG has no problems", svgProblems('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M0 0" /></svg>').join(","), "");
ok("no root svg is a problem", svgProblems("<div></div>").some((problem) => problem.includes("no root")));
ok("no viewBox is a problem", svgProblems('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" /></svg>').some((problem) => problem.includes("viewBox")));
ok("a script is a problem", svgProblems('<svg viewBox="0 0 24 24"><script>1</script></svg>').some((problem) => problem.includes("<script>")));
ok("an event attribute is a problem", svgProblems('<svg viewBox="0 0 24 24"><path onclick="x()" d="M0 0" /></svg>').some((problem) => problem.includes("event")));
ok("an external href is a problem", svgProblems('<svg viewBox="0 0 24 24"><use href="https://example.com/a.svg" /></svg>').some((problem) => problem.includes("href")));
ok("a fragment href is fine", svgProblems('<svg viewBox="0 0 24 24"><use href="#a" /></svg>').join(",") === "");
ok("an image is a problem", svgProblems('<svg viewBox="0 0 24 24"><image href="#a" /></svg>').some((problem) => problem.includes("<image>")));
ok("a foreign object is a problem", svgProblems('<svg viewBox="0 0 24 24"><foreignObject /></svg>').some((problem) => problem.includes("foreignObject")));
ok("a colour is a problem", svgProblems('<svg viewBox="0 0 24 24"><path fill="red" d="M0 0" /></svg>').some((problem) => problem.includes("colour")));
ok("none and a url reference are fine", svgProblems('<svg viewBox="0 0 24 24"><path fill="none" stroke="url(#a)" d="M0 0" /></svg>').join(",") === "");
ok("a style attribute that sets a colour is a problem", svgProblems('<svg viewBox="0 0 24 24"><path style="fill: red" d="M0 0" /></svg>').some((problem) => problem.includes("style")));

done();
