// node-only
/**
 * @file What @light/highlight reaches at runtime from its exports: nothing: the tokenizers stand alone.
 */
import { done, eq, ok } from "@light/test/assert.ts";
import { packagesLine, reachOf } from "@light/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "nothing", packagesLine(reach, "@light/highlight"), "");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
done();
