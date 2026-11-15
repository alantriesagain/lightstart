// node-only
/**
 * @file What @lightstart/plugins reaches at runtime from its exports: light's width tables and lib: nothing of the engine's host or templates.
 */
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { packagesLine, reachOf } from "@lightstart/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "@lightstart/lib, @lightstart/light", packagesLine(reach, "@lightstart/plugins"), "@lightstart/lib, @lightstart/light");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
ok("it does not reach @lightstart/light's html", !reach.reaches("@lightstart/light", "html"));
ok("it does not reach @lightstart/light's native/tui/host.ts", !reach.reaches("@lightstart/light", "native/tui/host.ts"));
ok("it reaches @lightstart/light's native/tui/width.ts", reach.reaches("@lightstart/light", "native/tui/width.ts"));
done();
