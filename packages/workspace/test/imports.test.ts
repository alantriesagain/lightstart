// node-only
/**
 * @file What @lightstart/workspace reaches at runtime from its exports: light (the controller) and lib.
 */
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { packagesLine, reachOf } from "@lightstart/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "@lightstart/lib, @lightstart/light", packagesLine(reach, "@lightstart/workspace"), "@lightstart/lib, @lightstart/light");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
done();
