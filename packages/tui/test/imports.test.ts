// node-only
/**
 * @file What @lightstart/tui reaches at runtime from its exports: light and lib.
 */
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { packagesLine, reachOf } from "@lightstart/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "@lightstart/lib, @lightstart/light", packagesLine(reach, "@lightstart/tui"), "@lightstart/lib, @lightstart/light");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
done();
