// node-only
/**
 * @file What @light/ui reaches at runtime from its exports: light and lib.
 */
import { done, eq, ok } from "@light/test/assert.ts";
import { packagesLine, reachOf } from "@light/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "@bootstrapp/light, @light/lib", packagesLine(reach, "@light/ui"), "@bootstrapp/light, @light/lib");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
done();
