/**
 * @file The plugin kernel: plugins started after what they require, in the order added otherwise; one
 * switched off in config.json left out with whatever needs it, a missing or looping requirement
 * reported; stopping in reverse; commands run by name and listed for /help, a later one replacing
 * an earlier of the same name; actions with their default keys, dispatched by scope from the most
 * specific, a key's own actions (the last added first) before "*", one passing a key on; the
 * keymap's layers over them (a rebinding, null unbinding, the newest first, the user's before all,
 * off and on, gone with their owner); hints by scope; hooks in order; plugin settings and kept
 * state written and read back.
 */
import { Command } from "../commands.ts";
import { Hook } from "@light/lib/hook.ts";
import { Kernel } from "../kernel.ts";
import { Action } from "../actions.ts";
import { KeyEntry, Layer, keySpec } from "../keys.ts";
import { KeyEvent } from "@bootstrapp/light/native/tui";
import { Plugin } from "../plugin.ts";
import { NoStateFile } from "../settings.ts";
import { done, eq, ok } from "@light/test/assert.ts";

class Journal {
  lines: string[] = [];
}

class Probe extends Plugin {
  readonly journal: Journal;

  constructor(id: string, requires: string[], journal: Journal) {
    super(id, requires);
    this.journal = journal;
  }

  override activate(): void {
    this.journal.lines.push("+" + this.id);
  }

  override deactivate(): void {
    this.journal.lines.push("-" + this.id);
  }
}

const startWith = (plugins: string[][], config: string): Kernel => {
  const journal = new Journal();
  const k = new Kernel();
  k.settings.load(JSON.parse(config));
  for (const p of plugins) k.use(new Probe(p[0], p.slice(1), journal));
  k.start();
  return k;
};

const order = (k: Kernel): string => k.started.map((p) => p.id).join(" ");

let k = startWith([["status", "chat"], ["git", "files"], ["chat"], ["files"], ["changes", "files", "git"]], "{}");
eq("requirements first, otherwise in the order added", order(k), "chat status files git changes");
k = startWith([["status", "chat"], ["git", "files"], ["chat"], ["files"], ["changes", "files", "git"]], '{"git": false, "chat": {"x": 1}}');
eq("one switched off is left out, with what needs it", order(k) + " | " + k.problems.join("; "), "chat status files | changes: needs git, which is off");
k = startWith([["a", "missing"], ["b", "c"], ["c", "b"], ["d"]], "{}");
eq("a missing or looping requirement is reported, not thrown", order(k) + " | " + k.problems.join("; "), "d | a: needs missing, which is not built in; b: its requirements loop back to it; c: needs b, which is off; b: needs c, which is off");
const journal = new Journal();
const k2 = new Kernel();
k2.use(new Probe("one", [], journal));
k2.use(new Probe("two", ["one"], journal));
k2.start();
k2.stop();
eq("activated in order, deactivated in reverse", journal.lines.join(" "), "+one +two -two -one");
const second = new Journal();
const twice = new Kernel();
twice.use(new Probe("one", [], second));
twice.use(new Probe("two", ["one"], second));
twice.start();
twice.start();
eq("a second start stops what the first started", second.lines.join(" "), "+one +two -two -one +one +two");

class Thrower extends Plugin {
  constructor() {
    super("boom", []);
  }

  override activate(): void {
    throw new Error("no");
  }
}

const throwing = new Kernel();
throwing.use(new Thrower());
throwing.start();
ok("a throwing activation is a problem, not a throw", throwing.problems.join("; ").includes("boom: activation failed: no") && !throwing.has("boom"));

const needed = new Kernel();
const leaving = new Journal();
needed.use(new Probe("base", [], leaving));
needed.use(new Probe("top", ["base"], leaving));
needed.start();
const stopped = needed.remove("base");
eq("removing a plugin stops what needs it", stopped.join(",") + " | " + leaving.lines.join(" ") + " | " + String(needed.has("base")) + String(needed.has("top")), "top,base | +base +top -top -base | falsefalse");

const ran: string[] = [];
const kc = new Kernel();
kc.commands.add(new Command("/model", "<name>", "the model for this session", "models", (arg: string) => ran.push("model " + arg)));
kc.commands.add(new Command("/help", "", "this list", "shell", (_arg: string) => ran.push("help")));
kc.commands.add(new Command("/model", "<name>", "a replacement", "other", (arg: string) => ran.push("other " + arg)));
ok("a command by name, its argument trimmed", kc.commands.run("/model  fable[1m] "));
ok("not a command", !kc.commands.run("/nope") && !kc.commands.run("hello"));
eq("ran, the later of a name winning", ran.join(", "), "other fable[1m]");
eq("listed by name for /help", kc.commands.all().map((c) => c.name + " " + c.usage + " · " + c.help).join(" | "), "/help  · this list | /model <name> · a replacement");

const got: string[] = [];
const kk = new Kernel();
const act = (id: string, scope: string, help: string, keys: string[], owner: string, took: (k: KeyEvent, count: number) => boolean): void =>
  kk.actions.add(new Action(id, scope, help, keys, owner, (k: KeyEvent, count: number) => {
    const t = took(k, count);
    got.push(id + (count > 1 ? "×" + String(count) : "") + (t ? "" : " (passed)"));
    return t;
  }));
act("models.next", "", "model", ["f5"], "models", () => true);
act("code.next", "code", "changes", ["char:n"], "code", () => true);
act("code.previous", "code", "changes", ["char:p"], "code", () => true);
act("sessions.new", "files", "n new", ["char:n"], "sessions", () => true);
act("chat.escape", "", "", ["escape"], "chat", () => false);
act("files.any", "files", "", ["*"], "files", (k: KeyEvent) => k.key === "down");
act("files.open", "files", "", ["enter"], "files", () => true);
act("files.later", "files", "", ["enter"], "files", () => false);
const press = (name: string, text: string, scopes: string[]): string => kk.keys.dispatch(new KeyEvent(name, text, false, false, false), scopes);
eq("a global key from any scope", press("f5", "", ["code", ""]), "models.next");
eq("a scoped key in its scope", press("char", "n", ["code", ""]), "code.next");
eq("the same key in another scope", press("char", "n", ["files", ""]), "sessions.new");
eq("an action that passes a key on", press("escape", "", ["code", ""]), "");
eq("* takes any key in its scope, after the key's own actions", press("down", "", ["files", ""]), "files.any");
eq("and passes what it does not use", press("char", "q", ["files", ""]), "");
eq("two actions on one key: the one added last first, the other when it passes", press("enter", "", ["files", ""]), "files.open");
eq("each went to its action", got.join(", "), "models.next, code.next, sessions.new, chat.escape (passed), files.any, files.any (passed), files.later (passed), files.open");
eq("specs", [keySpec("char", "]", false, false, false), keySpec("down", "", false, true, false), keySpec("tab", "", false, false, true), keySpec("char", "C", true, false, true)].join(" "), "char:] alt+down shift+tab ctrl+char:C");
eq("hints by scope: the keys as bound, actions with the same help as one, one written key first as written", kk.keys.hints("") + " | " + kk.keys.hints("code") + " | " + kk.keys.hints("files"), "F5 model | n/p changes | n new");
eq("the keys an action is bound to", kk.keys.bound("files.open").join(",") + " | " + kk.keys.bound("files.any").join(",") + " | " + kk.keys.bound("nope").join(","), "enter |  | ");
ok("a later action of an id replaces the earlier", (() => {
  kk.actions.add(new Action("files.later", "files", "", ["char:l"], "files", () => true));
  return kk.actions.all().filter((a: Action) => a.id === "files.later").length === 1 && kk.keys.bound("files.later").join(",") === "char:l";
})());

got.length = 0;
kk.keys.addLayer(new Layer("mine", "p1", [new KeyEntry("", "f6", ["models.next"], false), new KeyEntry("files", "enter", ["sessions.new"], false), new KeyEntry("files", "char:n", [], true)]));
eq("a layer binds a key to an action", press("f6", "", ["code", ""]), "models.next");
eq("and rebinds one: the base's actions on it are shadowed", press("enter", "", ["files", ""]) + " | " + kk.keys.bound("files.open").join(","), "sessions.new | ");
const was = got.length;
eq("null unbinds: the key runs nothing in the scope (the layer decides it, the base's * not asked)", press("char", "n", ["files", ""]) + " " + String(got.length - was), " 0");
kk.keys.addLayer(new Layer("mode", "p1", [new KeyEntry("files", "*", ["sessions.new"], false), new KeyEntry("files", "enter", [], true)]));
eq("a layer with * is a whole keymap for the scope: it takes the keys it does not name, before the base's own", press("char", "q", ["files", ""]) + " " + press("enter", "", ["files", ""]) + " " + press("down", "", ["files", ""]), "sessions.new  sessions.new");
kk.keys.removeOwner("p1");
kk.keys.addLayer(new Layer("mine", "p1", [new KeyEntry("", "f6", ["models.next"], false), new KeyEntry("files", "enter", ["sessions.new"], false), new KeyEntry("files", "char:n", [], true)]));
eq("bound follows the layer", kk.keys.bound("models.next").join(","), "f5,f6");
kk.keys.addLayer(new Layer("later", "p2", [new KeyEntry("", "f6", ["chat.escape"], false)]));
eq("a newer layer comes first", press("f6", "", ["code", ""]) + " " + got.slice(-1).join(""), " chat.escape (passed)");
ok("a layer turned off steps aside, and comes back on", kk.keys.setLayer("p2", "later", false) && press("f6", "", ["code", ""]) === "models.next" && kk.keys.setLayer("p2", "later", true) && press("f6", "", ["code", ""]) === "");
ok("an unknown layer", !kk.keys.setLayer("p2", "nope", true));
kk.keys.setUser([new KeyEntry("", "f6", ["models.next"], false)]);
eq("the user's layer before every plugin's", press("f6", "", ["code", ""]), "models.next");
kk.keys.setUser([]);
kk.keys.removeOwner("p2");
const baseAction = new Action("same", "", "", [], "core", () => true);
const replacement = new Action("same", "", "", [], "plug", () => true);
kk.actions.add(baseAction);
kk.actions.add(replacement);
kk.actions.removeOwner("plug");
ok("a removed replacement restores what it replaced", kk.actions.find("same") === baseAction);
eq("a plugin's layers go with it", press("f6", "", ["code", ""]) + " " + String(kk.keys.all().map((l: Layer) => l.id).join(",")), "models.next mine");
kk.actions.removeOwner("files");
eq("its actions too", press("enter", "", ["files", ""]) + " " + press("down", "", ["files", ""]), "sessions.new ");

const hook = new Hook();
const fired: string[] = [];
hook.add("a", () => fired.push("a"));
hook.add("b", () => fired.push("b"));
hook.fire();
eq("hooks fire in order", fired.join("") + " " + String(hook.size), "ab 2");
const during: string[] = [];
const changing = new Hook();
changing.add("one", () => {
  during.push("one");
  changing.remove("two");
  changing.add("three", () => during.push("three"));
});
changing.add("two", () => during.push("two"));
changing.fire();
eq("a listener removed during a fire is not called, one added then waits for the next", during.join(","), "one");

const ks = new Kernel();
ks.settings.load(JSON.parse('{"status": {"separator": " · "}, "git": false, "code": true}'));
const status = ks.settings.section("status") as { separator?: unknown } | null;
eq("a plugin's settings; one switched off; true is on", String(status !== null ? status.separator : "none") + "|" + String(ks.settings.isOff("git")) + "|" + String(ks.settings.isOff("code")) + "|" + String(ks.settings.section("code")), " · |true|false|null");
ks.settings.load(JSON.parse('["not", "an", "object"]'));
ok("a plugins value that is not an object turns every plugin on, with a notice", !ks.settings.isOff("git") && ks.settings.notice.length > 0);
ks.settings.load(JSON.parse('{"git": "no"}'));
ok("an invalid plugin value is left on, with a notice", !ks.settings.isOff("git") && ks.settings.notice.includes("not true, false or an object"));
ks.settings.load({});
ok("a new config clears the old notice", ks.settings.notice === "");
const file = new NoStateFile();
ks.settings.useStateFile(file);
const wrap: unknown = { wrap: true };
ks.settings.setState("code", wrap);
const tab: unknown = { tab: "git" };
ks.settings.setState("files", tab);
const nothing: unknown = { wrap: false };
ks.settings.setState("code", nothing);
const again = new Kernel();
again.settings.useStateFile(file);
const code = again.settings.state("code") as { wrap?: unknown } | null;
const files = again.settings.state("files") as { tab?: unknown } | null;
eq("kept state written and read back", String(code !== null ? code.wrap : "none") + " " + String(files !== null ? files.tab : "none") + " " + String(again.settings.state("git")), "false git null");
const broken = new NoStateFile();
broken.text = "{nope";
again.settings.useStateFile(broken);
ok("a broken state file is left aside, with a notice", again.settings.state("code") === null && again.settings.notice.includes("not valid JSON"));
done();
