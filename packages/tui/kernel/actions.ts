/**
 * @file Actions: what a key can do, each with a name a keymap binds keys to ("chat.history.back",
 * "app.focus.code", "files.open"). An action belongs to a scope ("" for anywhere, a column, a tab,
 * "input" for the focused composer) and has its default keys (specs, keys.ts), which the base
 * keymap binds unless a layer rebinds them; `help` shows in the hints while its scope is active
 * (actions of a scope with the same help show as one). The core adds its own and the plugins
 * theirs; a later action of an id replaces the earlier (a plugin can replace the core's).
 */
import type { KeyEvent } from "@bootstrapp/light/native/tui";
import { Keyed } from "./registry.ts";

export class Action {
  readonly id: string;
  readonly scope: string;
  /** "F5 model" in the hints while the scope is active; "" for none. */
  readonly help: string;
  /** Its default keys, as specs; [] for none (bound by a keymap alone, or a hint alone). */
  readonly keys: string[];
  readonly owner: string;
  /** Does it; true when it took the key (`count` repeats it, 1 by default). */
  readonly onRun: (key: KeyEvent, count: number) => boolean;

  constructor(id: string, scope: string, help: string, keys: string[], owner: string, onRun: (key: KeyEvent, count: number) => boolean) {
    this.id = id;
    this.scope = scope;
    this.help = help;
    this.keys = keys;
    this.owner = owner;
    this.onRun = onRun;
  }
}

export class Actions {
  private list = new Keyed<Action>();

  /** Add `a`; a later action of the same id replaces the earlier, in its place. */
  add(a: Action): void {
    this.list.put(a.id, a.owner, a);
  }

  /** Drop every action plugin `owner` added. */
  removeOwner(owner: string): void {
    this.list.removeOwner(owner);
  }

  find(id: string): Action | null {
    return this.list.get(id);
  }

  /** Every action, in the order added. */
  all(): Action[] {
    return this.list.values();
  }

  /** The actions of `scope` with default key `spec`, the one added last first (it goes first). */
  bound(scope: string, spec: string): Action[] {
    const out: Action[] = [];
    const all = this.list.values();
    for (let i = all.length - 1; i >= 0; i--) {
      const a = all[i];
      if (a.scope === scope && a.keys.includes(spec)) out.push(a);
    }
    return out;
  }
}

/** `owner`'s actions in `scope`, added one by one. */
export class Binder {
  readonly actions: Actions;
  readonly owner: string;
  readonly scope: string;

  constructor(actions: Actions, owner: string, scope: string) {
    this.actions = actions;
    this.owner = owner;
    this.scope = scope;
  }

  /** Add action `id` with its default `keys` (specs) and `help`; `onRun` answers whether it took the key. */
  add(id: string, keys: string[], help: string, onRun: (key: KeyEvent, count: number) => boolean): void {
    this.actions.add(new Action(id, this.scope, help, keys, this.owner, onRun));
  }
}
