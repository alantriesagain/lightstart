// node-only
/**
 * @file What @light/kernel reaches at runtime from its exports: lib alone: light is a type to it.
 */
import { done, eq, ok } from "@light/test/assert.ts";
import { packagesLine, reachOf } from "@light/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "@light/lib", packagesLine(reach, "@light/kernel"), "@light/lib");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
done();
