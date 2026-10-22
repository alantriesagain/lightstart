// node-only
/**
 * @file What @light/test reaches at runtime from its exports: nothing at runtime: the headless screen imports light at the test's own run.
 */
import { done, eq, ok } from "@light/test/assert.ts";
import { packagesLine, reachOf } from "@light/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "nothing", packagesLine(reach, "@light/test"), "");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
done();
