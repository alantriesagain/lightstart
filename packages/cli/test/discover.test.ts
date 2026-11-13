// node-only
/**
 * @file Node discovery: a project's declared scopes, the workspace root tier, a package's
 * `light.cli` roots, the binary's own install folder, and lazy listing (a file is not imported
 * until it is needed).
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Registry, buildContext, renderHelp, runCommand } from "../index.ts";
import type { LogLevel } from "../index.ts";
import { discover } from "../node/index.ts";
import { captureLogger, silentLogger } from "./_helpers.ts";
import { done, eq, eqn, ok } from "@light/test/assert.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const level: LogLevel = "silent";

const scopes = await discover({ projectDir: join(FIXTURES, "proj-scopes"), scopes: ["@lightstart"], packages: [], log: silentLogger });
ok("the project's own command is listed", scopes.commands.has("local"));
ok("a scope the project declares is scanned", scopes.commands.has("acme"));
eq("a package's source is its package name", scopes.commands.get("acme")?.source.name ?? "", "@acme/base");
ok("the built-in scopes are still scanned", scopes.commands.has("builtin"));

const workspace = await discover({ projectDir: join(FIXTURES, "ws", "app"), scopes: [], packages: [], log: silentLogger });
ok("a member command is listed", workspace.commands.has("member"));
ok("the workspace root's node_modules is scanned after the project", workspace.commands.has("root"));
eq("the workspace package keeps its own source", workspace.commands.get("root")?.source.name ?? "", "@acme/root");

const inherited = await discover({ projectDir: join(FIXTURES, "ws-config", "app"), scopes: [], packages: [], log: silentLogger });
ok("a member inherits the scopes its workspace root declares", inherited.commands.has("inherited"));
ok("and the packages it names, by their light.cli roots", inherited.commands.has("area"));
eq("a named package's root keeps its name and folder", inherited.commands.get("area")?.source.name ?? "", "core/areas");

const areas = await discover({ projectDir: join(FIXTURES, "proj-areas"), scopes: [], packages: [], log: silentLogger });
ok("the first named root contributes", areas.commands.has("event"));
ok("the second named root contributes", areas.commands.has("tool"));
ok("the plain cli/ folder is not scanned when light.cli names roots", !areas.commands.has("ignored"));
eq("a named root's source is the package and folder", areas.commands.get("event")?.source.name ?? "", "<project>/events");

const fakeCli = join(FIXTURES, "fake-cli");
const own = await discover({ projectDir: join(FIXTURES, "proj-plain"), scopes: ["@acme"], packages: [], cliDir: fakeCli, log: silentLogger });
ok("cliDir is scanned as the binary's own install", own.commands.has("plugin"));
eq("the result names the cliDir", own.cliDir, fakeCli);

const lazyLog = captureLogger();
const lazy = await discover({ projectDir: join(FIXTURES, "proj-lazy"), scopes: [], packages: [], log: lazyLog });
ok("a command file is listed without importing it", lazy.commands.has("bad"));
ok("a hook file is listed without importing it", (lazy.hooks.get("serve:after") ?? []).length === 1);
eqn("listing warns of nothing", lazyLog.messages.length, 0);

const lazyRegistry = new Registry("light", {}, lazy, lazyLog);
const lazyOpts = { name: "light", projectDir: join(FIXTURES, "proj-lazy"), cliDir: "", registry: lazyRegistry, level };
const good = await renderHelp(lazyRegistry, "light", "good");
ok("help for another command does not import the broken command", good.includes("good command"));
eqn("running another command is unaffected", await runCommand("good", [], lazyOpts), 0);
eqn("running the broken command answers 1", await runCommand("bad", [], lazyOpts), 1);
ok("the broken command reported its load error", lazyLog.messages.some((message) => message.level === "error" && message.text.includes("bad command cannot load")));

const lazyCtx = buildContext(lazyOpts, lazyRegistry, (name: string, args: readonly string[] = []) => runCommand(name, args, lazyOpts), []);
const hookRun = await lazyRegistry.runHook("serve:after", lazyCtx, undefined);
ok("a broken hook loads only when dispatched and is skipped", hookRun.ran === 0);
ok("the hook load failure warns with its source", lazyLog.messages.some((message) => message.level === "warn" && message.text.includes("Hook serve:after from <project> failed to load")));

done();
