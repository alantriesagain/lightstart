// node-only
/**
 * @file What @light/workspace reaches at runtime from its exports: light (the controller) and lib.
 */
import { done, eq, ok } from "@light/test/assert.ts";
import { packagesLine, reachOf } from "@light/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "@light/lib, @lightstart/light", packagesLine(reach, "@light/workspace"), "@light/lib, @lightstart/light");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
done();
