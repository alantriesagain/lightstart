// node-only
/**
 * @file What @lightstart/kernel reaches at runtime from its exports: lib alone: light is a type to it.
 */
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { packagesLine, reachOf } from "@lightstart/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "@lightstart/lib", packagesLine(reach, "@lightstart/kernel"), "@lightstart/lib");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
done();
