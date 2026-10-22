// node-only
/**
 * @file What @light/lib reaches at runtime from its exports: nothing: the core's helpers are light-free.
 */
import { done, eq, ok } from "@light/test/assert.ts";
import { packagesLine, reachOf } from "@light/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "nothing", packagesLine(reach, "@light/lib"), "");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
done();
