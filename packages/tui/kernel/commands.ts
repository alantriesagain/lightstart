/**
 * @file Slash commands typed in the composer ("/resume", "/model fable"). A plugin adds its own; `/help`
 * lists them all from here, so a command is documented where it is defined. A command may name the
 * values its argument takes as it is typed (the composer's strip lists them).
 */
import { Keyed } from "./registry.ts";

/** A value a command's argument can take, as the strip shows it: what goes in, how it reads, a note beside it. */
export class Suggestion {
  value: string;
  label: string;
  detail: string;

  constructor(value: string, label: string, detail: string) {
    this.value = value;
    this.label = label;
    this.detail = detail;
  }
}

export class Command {
  /** With its slash: "/model". */
  readonly name: string;
  /** What follows the name in the help ("<name>"; "" for none). */
  readonly usage: string;
  readonly help: string;
  readonly owner: string;
  readonly onCommand: (arg: string) => void;
  /** The values its argument can take given what is typed so far, best first (null: it names none). */
  onComplete: ((arg: string) => Suggestion[]) | null = null;

  constructor(name: string, usage: string, help: string, owner: string, onCommand: (arg: string) => void) {
    this.name = name;
    this.usage = usage;
    this.help = help;
    this.owner = owner;
    this.onCommand = onCommand;
  }
}

export class Commands {
  private list = new Keyed<Command>();

  /** Add `c`; a later command of the same name replaces the earlier one. */
  add(c: Command): void {
    this.list.put(c.name, c.owner, c);
  }

  /** Drop `owner`'s command `name` (one it replaced comes back); false when `owner` has none of that name. */
  remove(name: string, owner: string): boolean {
    return this.list.remove(name, owner);
  }

  /** Drop every command plugin `owner` added. */
  removeOwner(owner: string): void {
    this.list.removeOwner(owner);
  }

  find(name: string): Command | null {
    return this.list.get(name);
  }

  /** Every command, by name. */
  all(): Command[] {
    const out = this.list.values();
    out.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return out;
  }

  /** Run `text` ("/name arg") when it names a command; false when it does not. */
  run(text: string): boolean {
    if (!text.startsWith("/")) return false;
    const space = text.indexOf(" ");
    const c = this.find(space > 0 ? text.slice(0, space) : text);
    if (c === null) return false;
    c.onCommand(space > 0 ? text.slice(space + 1).trim() : "");
    return true;
  }
}
