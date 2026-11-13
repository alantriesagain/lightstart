/**
 * @file The registry: static commands, aliases, discovered commands loaded on demand, duplicate
 * warnings, and routes loaded on the first call.
 * Runs under node and natively; the outputs must be identical.
 */
import { Registry, defineCommand } from "../index.ts";
import type { ArgsSchema, Command, Logger } from "../index.ts";
import { TestLoader, captureLogger, emptyDiscovered, silentLogger, source } from "./_helpers.ts";
import { done, eq, ok } from "@light/test/assert.ts";

const commands: Record<string, Command<ArgsSchema>> = {
  hello: defineCommand<ArgsSchema>({
    description: "Says hello",
    args: { name: { positional: true, default: "world" } },
    run() {
      return 0;
    },
  }),
  greet: defineCommand({
    description: "Greets",
    aliases: ["g"],
    run() {
      return 0;
    },
  }),
};

const registry = new Registry("light", commands, emptyDiscovered(), silentLogger);

const hello = await registry.loadCommand("hello");
ok("a static command loads", hello !== null && hello.command.description === "Says hello");
ok("the same record comes back", (await registry.loadCommand("hello")) === hello);
ok("an alias resolves to its command", (await registry.loadCommand("g")) === (await registry.loadCommand("greet")));
ok("an unknown command answers null", (await registry.loadCommand("nope")) === null);
ok("the names include aliases", registry.listCommandNames().includes("g") && registry.listCommandNames().includes("hello"));
ok("hasCommand reads the table", registry.hasCommand("hello") && !registry.hasCommand("g"));

const log = captureLogger();
const logger: Logger = { log: log.log, warn: log.warn, error: log.error, debug: log.debug };
const loader = new TestLoader();
loader.add("extra.ts", { default: defineCommand({ description: "Another hello", run() { return 1; } }) });
const discovered = emptyDiscovered();
discovered.loader = loader;
discovered.commands.set("hello", { file: "dup.ts", source: source("@lightstart/other") });
discovered.commands.set("extra", { file: "extra.ts", source: source("@lightstart/other") });
const merged = new Registry("light", commands, discovered, logger);
eq("a static command wins a duplicate", (await merged.loadCommand("hello"))?.command.description ?? "", "Says hello");
ok("the duplicate warns", log.messages.some((m) => m.level === "warn" && m.text.includes('Command "hello" already registered by light')));
eq("a discovered command is imported on demand", (await merged.loadCommand("extra"))?.command.description ?? "", "Another hello");

const routes: unknown[] = [() => null];
loader.add("api.ts", { default: routes[0] });
const withRoutes = emptyDiscovered();
withRoutes.loader = loader;
withRoutes.routes.push({ file: "api.ts", source: source("<project>") });
const routeRegistry = new Registry("light", {}, withRoutes, silentLogger);
const loaded = await routeRegistry.loadRoutes();
eq("a route file's default export is answered", typeof loaded[0], "function");
ok("loadRoutes is stable", (await routeRegistry.loadRoutes()) === loaded);

done();
