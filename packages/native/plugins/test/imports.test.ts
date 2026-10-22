// node-only
/**
 * @file What @light/plugins reaches at runtime from its exports: light's width tables and lib: nothing of the engine's host or templates.
 */
import { done, eq, ok } from "@light/test/assert.ts";
import { packagesLine, reachOf } from "@light/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "@bootstrapp/light, @light/lib", packagesLine(reach, "@light/plugins"), "@bootstrapp/light, @light/lib");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
ok("it does not reach @bootstrapp/light's html", !reach.reaches("@bootstrapp/light", "html"));
ok("it does not reach @bootstrapp/light's native/tui/host.ts", !reach.reaches("@bootstrapp/light", "native/tui/host.ts"));
ok("it reaches @bootstrapp/light's native/tui/width.ts", reach.reaches("@bootstrapp/light", "native/tui/width.ts"));
done();
