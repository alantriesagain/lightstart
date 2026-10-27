// node-only
/**
 * @file What @light/markdown reaches at runtime from its exports: the tokenizers, the palette and light's lines: nothing of the engine's host or templates.
 */
import { done, eq, ok } from "@light/test/assert.ts";
import { packagesLine, reachOf } from "@light/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "@light/highlight, @light/ui, @lightstart/light", packagesLine(reach, "@light/markdown"), "@light/highlight, @light/ui, @lightstart/light");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
ok("it does not reach @lightstart/light's html", !reach.reaches("@lightstart/light", "html"));
ok("it does not reach @lightstart/light's native/tui/host.ts", !reach.reaches("@lightstart/light", "native/tui/host.ts"));
done();
