// node-only
/**
 * @file What @lightstart/lib reaches at runtime from its exports: nothing: the core's helpers are light-free.
 */
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { packagesLine, reachOf } from "@lightstart/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "nothing", packagesLine(reach, "@lightstart/lib"), "");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
done();
