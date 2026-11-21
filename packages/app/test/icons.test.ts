// node-only
/**
 * @file The icon scanner: the literal names a source writes, the variants and
 * sizes an element asks for, the names a module declares, and the bindings
 * whose name is an expression.
 */

import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";
import { scanIcons } from "../node/icons.ts";

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

done();
