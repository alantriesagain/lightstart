// node-only
/**
 * @file What @lightstart/highlight reaches at runtime from its exports: nothing: the tokenizers stand alone.
 */
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { packagesLine, reachOf } from "@lightstart/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "nothing", packagesLine(reach, "@lightstart/highlight"), "");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
done();
