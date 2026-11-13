/**
 * @file Command extensions: args merge into the command's schema, a collision is exit 2, setup
 * runs in order with the api the command passes, a throw is exit 1, and help lists the args under
 * the extension's source.
 * Runs under node and natively; the outputs must be identical.
 */
import { Registry, defineCommand, defineExtension, renderHelp, runCommand } from "../index.ts";
import type { ArgsSchema, Command, LogLevel } from "../index.ts";
import { TestLoader, emptyDiscovered, silentLogger, source } from "./_helpers.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

declare module "../index.ts" {
  interface Extensions {
    serve: { port: number; tags: string[] };
    collide: { ok: boolean };
    broken: { ok: boolean };
    ordered: { log: string[] };
    plain: undefined;
  }
}

const events: string[] = [];

const commands: Record<string, Command<ArgsSchema>> = {
  serve: defineCommand<ArgsSchema>({
    description: "Serve",
    args: { port: { default: "3000", description: "Port" } },
    async run(ctx, args) {
      events.push(`run:${String(args.port)}`);
      await ctx.cli.extend("serve", { port: 8080, tags: ["api"] });
      events.push("done");
      return 0;
    },
  }),
  collide: defineCommand<ArgsSchema>({
    description: "Collide",
    args: { port: { default: "3000" } },
    async run(ctx) {
      events.push("collide ran");
      await ctx.cli.extend("collide", { ok: true });
      return 0;
    },
  }),
  broken: defineCommand<ArgsSchema>({
    description: "Broken",
    async run(ctx) {
      await ctx.cli.extend("broken", { ok: true });
      events.push("broken ran");
      return 0;
    },
  }),
  ordered: defineCommand<ArgsSchema>({
    description: "Ordered",
    async run(ctx) {
      const api = { log: events };
      await ctx.cli.extend("ordered", api);
      events.push("ordered ran");
      return 0;
    },
  }),
  plain: defineCommand<ArgsSchema>({
    description: "Plain",
    async run(ctx) {
      await ctx.cli.extend("plain", undefined);
      events.push("plain ran");
      return 0;
    },
  }),
};

const loader = new TestLoader();
loader.add("ext-a.ts", {
  default: defineExtension<"serve", ArgsSchema>("serve", {
    args: { extra: { flag: true, description: "An extension flag" } },
    setup(_ctx, args, api) {
      events.push(`a:${String(args.extra)}:${api.tags.join(",")}:${api.port}`);
    },
  }),
});
loader.add("ext-b.ts", {
  default: defineExtension("serve", {
    setup(_ctx, _args, api) {
      events.push(`b:${api.tags.join(",")}`);
    },
  }),
});
loader.add("collide.ts", {
  default: defineExtension<"collide", ArgsSchema>("collide", {
    args: { port: { flag: true } },
    setup() {
      events.push("collision setup ran");
    },
  }),
});
loader.add("broken.ts", {
  default: defineExtension("broken", {
    setup() {
      throw new Error("setup failed");
    },
  }),
});
loader.add("ordered-a.ts", {
  default: defineExtension("ordered", {
    setup(_ctx, _args, api) {
      api.log.push("a");
    },
  }),
});
loader.add("ordered-b.ts", {
  default: defineExtension("ordered", {
    setup(_ctx, _args, api) {
      api.log.push("b");
    },
  }),
});

const discovered = emptyDiscovered();
discovered.loader = loader;
discovered.extensions.set("serve", [
  { file: "ext-a.ts", source: source("@acme/alpha"), command: "serve" },
  { file: "ext-b.ts", source: source("@acme/beta"), command: "serve" },
]);
discovered.extensions.set("collide", [{ file: "collide.ts", source: source("@acme/collide"), command: "collide" }]);
discovered.extensions.set("broken", [{ file: "broken.ts", source: source("@acme/broken"), command: "broken" }]);
discovered.extensions.set("ordered", [
  { file: "ordered-a.ts", source: source("@acme/a"), command: "ordered" },
  { file: "ordered-b.ts", source: source("@acme/b"), command: "ordered" },
]);

const registry = new Registry("light", commands, discovered, silentLogger);
const level: LogLevel = "silent";
const opts = { name: "light", projectDir: "/tmp/project", cliDir: "", registry, level };

eqn("an extension's flag is parsed with the command's args", await runCommand("serve", ["--port", "4000", "--extra"], opts), 0);
eq("setup ran before the command finished", JSON.stringify(events), '["run:4000","a:true:api:8080","b:api","done"]');

events.length = 0;
eqn("a colliding argument is an argument error", await runCommand("collide", [], opts), 2);
eq("a colliding extension does not run", JSON.stringify(events), "[]");

events.length = 0;
eqn("a throwing setup answers 1", await runCommand("broken", [], opts), 1);
eq("a throwing setup stops the command", JSON.stringify(events), "[]");

events.length = 0;
eqn("every extension of a command runs", await runCommand("ordered", [], opts), 0);
eq("setup runs in discovery order, then the command", JSON.stringify(events), '["a","b","ordered ran"]');

events.length = 0;
eqn("a command nobody extends still runs", await runCommand("plain", [], opts), 0);
eq("extend is a no-op with no extensions", JSON.stringify(events), '["plain ran"]');

const help = await renderHelp(registry, "light", "serve");
ok("the command's own option is listed", help.includes("Port"));
ok("the extension's source is named", help.includes("@acme/alpha:"));
ok("the extension's option is listed", help.includes("--extra"));

done();
