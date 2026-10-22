// node-only
/**
 * @file What @light/markdown reaches at runtime from its exports: the tokenizers, the palette and light's lines: nothing of the engine's host or templates.
 */
import { done, eq, ok } from "@light/test/assert.ts";
import { packagesLine, reachOf } from "@light/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "@bootstrapp/light, @light/highlight, @light/ui", packagesLine(reach, "@light/markdown"), "@bootstrapp/light, @light/highlight, @light/ui");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
ok("it does not reach @bootstrapp/light's html", !reach.reaches("@bootstrapp/light", "html"));
ok("it does not reach @bootstrapp/light's native/tui/host.ts", !reach.reaches("@bootstrapp/light", "native/tui/host.ts"));
done();
