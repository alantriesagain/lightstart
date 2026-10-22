/**
 * @file Keys and keymaps. A key is written as a spec: modifiers then the key ("f5", "alt+down",
 * "shift+tab", "ctrl+char:c", "char:]"), or "*" for any key. A keymap binds specs to actions
 * (actions.ts) per scope; it is layered: the user's (keys.json), then the plugins' layers, the
 * newest first (a vi mode is a layer turned on and off), then the base, every action's default
 * keys. A key goes to the active scopes from the most specific; in a scope, the first layer with
 * an entry for its spec or a "*" entry decides (a layer with "*" is a whole keymap for the scope:
 * a mode), else the base: the actions with that default key (the one added last first), then
 * those with "*"; the first action answering true takes the key.
 *
 * In a hint, arrows with the same modifiers run together. An action whose keys a keymap unbound
 * shows no hint.
 */
import { Action, Actions } from "./actions.ts";
import type { KeyEvent } from "@bootstrapp/light/native/tui";
import { Keyed } from "./registry.ts";

/** A key as a spec; a character's shift is in its text, so it carries none. */
export const keySpec = (name: string, text: string, ctrl: boolean, alt: boolean, shift: boolean): string =>
  (ctrl ? "ctrl+" : "") + (alt ? "alt+" : "") + (shift && name !== "char" ? "shift+" : "") + (name === "char" ? "char:" + text : name);

/** The key names as a hint shows them (a name not here shows as written, its first letter up). */
const KEY_LABELS = ["up", "↑", "down", "↓", "left", "←", "right", "→", "escape", "Esc", "pageup", "PgUp", "pagedown", "PgDn", "delete", "Del", "backspace", "Backspace", "enter", "Enter", "tab", "Tab", "home", "Home", "end", "End", "insert", "Ins", "paste", "Paste"];
const ARROWS = ["↑", "↓", "←", "→"];

/** A spec as a hint shows it: "ctrl+char:k" is "Ctrl+K", "f5" "F5", "up" "↑", "char: " "Space", "shift+tab" "Shift+Tab". */
const keyLabel = (spec: string): string => {
  let rest = spec;
  let prefix = "";
  for (const mod of ["ctrl+", "alt+", "shift+"])
    if (rest.startsWith(mod)) {
      prefix += mod.charAt(0).toUpperCase() + mod.slice(1, mod.length - 1) + "+";
      rest = rest.slice(mod.length);
    }
  let key = rest;
  if (rest.startsWith("char:")) {
    const ch = rest.slice(5);
    key = ch === " " ? "Space" : prefix.length > 0 && ch.length === 1 ? ch.toUpperCase() : ch;
  } else {
    const at = KEY_LABELS.indexOf(rest);
    if (at >= 0 && at % 2 === 0) key = KEY_LABELS[at + 1];
    else if (/^f[0-9]+$/.test(rest)) key = rest.toUpperCase();
    else key = rest.charAt(0).toUpperCase() + rest.slice(1);
  }
  return prefix + key;
};

/** Labels joined as one hint's keys: arrows run together ("↑↓", "Ctrl+←→"), the rest with a slash ("n/p"), the arrows first. */
export const joinLabels = (labels: string[]): string => {
  const prefixes: string[] = [];
  const runs: string[] = [];
  const others: string[] = [];
  for (const l of labels) {
    const last = l.slice(l.length - 1);
    if (!ARROWS.includes(last)) {
      others.push(l);
      continue;
    }
    const prefix = l.slice(0, l.length - 1);
    const at = prefixes.indexOf(prefix);
    if (at >= 0) runs[at] += last;
    else {
      prefixes.push(prefix);
      runs.push(l);
    }
  }
  const parts: string[] = [];
  if (runs.length > 0) parts.push(runs.join(" "));
  if (others.length > 0) parts.push(others.join("/"));
  return parts.join(" ");
};

/** A table as keys.json or a plugin's layer holds it, `{ [scope]: { [spec]: id | id[] | null } }`, read into entries (an entry that is not a string, a list or null is left out). */
export const keyEntriesOf = (value: unknown): KeyEntry[] => {
  const out: KeyEntry[] = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) return out;
  const scopes = value as Record<string, unknown>;
  for (const scope of Object.keys(scopes)) {
    const table = scopes[scope];
    if (typeof table !== "object" || table === null || Array.isArray(table)) continue;
    const specs = table as Record<string, unknown>;
    for (const spec of Object.keys(specs)) {
      const v = specs[spec];
      if (spec.length === 0) continue;
      if (v === null) out.push(new KeyEntry(scope, spec, [], true));
      else if (typeof v === "string") out.push(new KeyEntry(scope, spec, [v], false));
      else if (Array.isArray(v)) {
        const ids: string[] = [];
        for (const id of v as unknown[]) if (typeof id === "string") ids.push(id);
        out.push(new KeyEntry(scope, spec, ids, false));
      }
    }
  }
  return out;
};

/** One line of a keymap: in `scope`, `spec` runs `actions` in turn; `unbound` (null in the table) binds it to nothing, shadowing the layers below. */
export class KeyEntry {
  readonly scope: string;
  readonly spec: string;
  readonly actions: string[];
  readonly unbound: boolean;

  constructor(scope: string, spec: string, actions: string[], unbound: boolean) {
    this.scope = scope;
    this.spec = spec;
    this.actions = actions;
    this.unbound = unbound;
  }
}

/** A keymap a plugin (or the user) brought, in effect while `active`. */
export class Layer {
  readonly id: string;
  readonly owner: string;
  active = true;
  entries: KeyEntry[];

  constructor(id: string, owner: string, entries: KeyEntry[]) {
    this.id = id;
    this.owner = owner;
    this.entries = entries;
  }

  find(scope: string, spec: string): KeyEntry | null {
    for (const e of this.entries) if (e.scope === scope && e.spec === spec) return e;
    return null;
  }
}

/** The owner of the user's layer (keys.json), which comes before every plugin's. */
export const USER = "user";

/** A layer's key: its owner's and its own id (two plugins may name a layer alike). */
const layerKey = (owner: string, id: string): string => owner + "\n" + id;

export class Keys {
  readonly actions: Actions;
  /** The layers in the order added; the one added last is tried first, the user's before all. */
  private layers = new Keyed<Layer>();

  constructor(actions: Actions) {
    this.actions = actions;
  }

  /** Add `layer`; a later layer of the same id and owner replaces the earlier, in its place. */
  addLayer(layer: Layer): void {
    this.layers.put(layerKey(layer.owner, layer.id), layer.owner, layer);
  }

  /** Turn layer `id` of `owner` on or off; false when there is none. */
  setLayer(owner: string, id: string, on: boolean): boolean {
    const l = this.layers.get(layerKey(owner, id));
    if (l === null) return false;
    l.active = on;
    return true;
  }

  /** The user's layer (keys.json): replaced whole. */
  setUser(entries: KeyEntry[]): void {
    this.layers.removeOwner(USER);
    if (entries.length > 0) this.layers.put(layerKey(USER, USER), USER, new Layer(USER, USER, entries));
  }

  /** Drop every layer plugin `owner` added. */
  removeOwner(owner: string): void {
    this.layers.removeOwner(owner);
  }

  /** The active layers in the order they are tried: the user's, then the newest first. */
  private ordered(): Layer[] {
    const out: Layer[] = [];
    const all = this.layers.values();
    for (const l of all) if (l.active && l.owner === USER) out.push(l);
    for (let i = all.length - 1; i >= 0; i--) if (all[i].active && all[i].owner !== USER) out.push(all[i]);
    return out;
  }

  /** The actions named by `ids`, onto `out`. */
  private named(ids: string[], out: Action[]): void {
    for (const id of ids) {
      const a = this.actions.find(id);
      if (a !== null) out.push(a);
    }
  }

  /**
   * The actions `spec` runs in `scope`, in order: the first active layer with an entry for it or a
   * "*" entry decides (its entry's actions then its "*" entry's; none at all when it unbinds the
   * key); else the base, the actions with that default key, then those with "*".
   */
  resolve(scope: string, spec: string): Action[] {
    for (const l of this.ordered()) {
      const e = l.find(scope, spec);
      const any = spec !== "*" ? l.find(scope, "*") : null;
      if (e === null && any === null) continue;
      const out: Action[] = [];
      if (e !== null) {
        if (e.unbound) return out;
        this.named(e.actions, out);
      }
      if (any !== null && !any.unbound) this.named(any.actions, out);
      return out;
    }
    const out = this.actions.bound(scope, spec);
    if (spec !== "*") for (const a of this.actions.bound(scope, "*")) out.push(a);
    return out;
  }

  /** Offer `key` to the scopes (most specific first). Answers the id of the action that took it, "" for none. */
  dispatch(key: KeyEvent, scopes: string[]): string {
    const spec = keySpec(key.key, key.text, key.ctrl, key.alt, key.shift);
    for (const scope of scopes) for (const a of this.resolve(scope, spec)) if (a.onRun(key, 1)) return a.id;
    return "";
  }

  /** The specs that run action `id` in its scope, as the keymap stands: its default keys unless a layer rebinds them, and any a layer adds. */
  bound(id: string): string[] {
    const a = this.actions.find(id);
    if (a === null) return [];
    const specs: string[] = [];
    for (const s of a.keys) if (!specs.includes(s)) specs.push(s);
    for (const l of this.ordered()) for (const e of l.entries) if (e.scope === a.scope && !specs.includes(e.spec)) specs.push(e.spec);
    return specs.filter((s) => s !== "*" && this.resolve(a.scope, s).includes(a));
  }

  /** The keys a hint shows for action `a`: the first of its default keys still bound (the rest are variants with modifiers), and every key a layer added. */
  private shown(a: Action): string[] {
    const out: string[] = [];
    let first = true;
    for (const spec of this.bound(a.id)) {
      if (a.keys.includes(spec)) {
        if (!first) continue;
        first = false;
      }
      out.push(spec);
    }
    return out;
  }

  /**
   * The hints of `scope`'s actions with help, in the order added: each action's keys as the keymap
   * binds them now (its first default key, and the keys layers added), then its help ("F5 model");
   * actions with the same help as one ("n/p changes", "↑↓ Enter opens"); an action with no key at
   * all, or whose help starts with its key as a hint written key first does ("F5 model"), its help
   * as written.
   */
  hints(scope: string): string[] {
    const helps: string[] = [];
    const labels: string[][] = [];
    const keyed: boolean[] = [];
    for (const a of this.actions.all()) {
      if (a.scope !== scope || a.help.length === 0) continue;
      let at = helps.indexOf(a.help);
      if (at < 0) {
        at = helps.length;
        helps.push(a.help);
        labels.push([]);
        keyed.push(a.keys.length > 0);
      }
      if (a.keys.length > 0) keyed[at] = true;
      for (const spec of this.shown(a)) {
        const l = keyLabel(spec);
        if (!labels[at].includes(l)) labels[at].push(l);
      }
    }
    const out: string[] = [];
    for (let i = 0; i < helps.length; i++) {
      if (keyed[i] && labels[i].length === 0) continue;
      const keys = joinLabels(labels[i]);
      const written = helps[i] === keys || helps[i].startsWith(keys + " ");
      out.push(keys.length > 0 && !written ? keys + " " + helps[i] : helps[i]);
    }
    return out;
  }

  /** Action `id`'s keys as a hint shows them ("" when it has none). */
  label(id: string): string {
    const a = this.actions.find(id);
    if (a === null) return "";
    const labels: string[] = [];
    for (const spec of this.shown(a)) labels.push(keyLabel(spec));
    return joinLabels(labels);
  }

  /** Every layer, in the order added (tests). */
  all(): Layer[] {
    return this.layers.values();
  }
}
