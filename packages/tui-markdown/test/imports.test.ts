// node-only
/**
 * @file What @lightstart/tui-markdown reaches at runtime from its exports: the tokenizers, the palette and light's lines: nothing of the engine's host or templates.
 */
import { done, eq, ok } from "@lightstart/test/assert.ts";
import { packagesLine, reachOf } from "@lightstart/test/imports.ts";

const reach = reachOf(".");
eq("it reaches " + "@lightstart/highlight, @lightstart/light, @lightstart/markdown, @lightstart/tui", packagesLine(reach, "@lightstart/tui-markdown"), "@lightstart/highlight, @lightstart/light, @lightstart/markdown, @lightstart/tui");
ok("and no app", !Array.from(reach.packages).some((p) => !p.startsWith("@")));
ok("it does not reach @lightstart/light's html", !reach.reaches("@lightstart/light", "html"));
ok("it does not reach @lightstart/light's native/tui/host.ts", !reach.reaches("@lightstart/light", "native/tui/host.ts"));
done();
