/**
 * @file The plugin kernel: the plugins an app is made of, started in the order their requirements give
 * (a plugin after the ones it requires, otherwise in the order they were added), the ones switched
 * off left out, along with any plugin whose requirement is off or missing, or whose activation
 * failed (reported in `problems`, not thrown). Plugins can come and go while it runs: `remove`
 * stops one and drops its commands, actions and keys, `startNew` starts the ones added since. It
 * also holds what every plugin shares regardless of the screen: the commands, the actions, the
 * keys and the settings.
 */
import { errorMessage } from "@light/lib/json.ts";
import { Actions } from "./actions.ts";
import { Commands } from "./commands.ts";
import { Keys } from "./keys.ts";
import { Plugin } from "./plugin.ts";
import { Settings } from "./settings.ts";

export class Kernel {
  readonly commands = new Commands();
  readonly actions = new Actions();
  readonly keys = new Keys(this.actions);
  readonly settings = new Settings();
  /** Every plugin added, in order. */
  plugins: Plugin[] = [];
  /** The plugins started, in the order they were activated. */
  started: Plugin[] = [];
  /** Plugins left out and why ("git: needs files, which is off"). */
  problems: string[] = [];
  /** The ids already considered (started or left out). */
  private done = new Set<string>();

  use(plugin: Plugin): void {
    this.plugins.push(plugin);
  }

  private find(id: string): Plugin | null {
    for (const p of this.plugins) if (p.id === id) return p;
    return null;
  }

  /** Whether plugin `id` was started. */
  has(id: string): boolean {
    for (const p of this.started) if (p.id === id) return true;
    return false;
  }

  /** Activate every plugin that is on and whose requirements started, requirements first. */
  start(): void {
    if (this.started.length > 0) this.stop();
    this.started = [];
    this.problems = [];
    this.done = new Set<string>();
    this.startNew();
  }

  /** Start the plugins added since the last start (after what they require). */
  startNew(): void {
    const visiting = new Set<string>();
    for (const p of this.plugins) this.visit(p, visiting, this.done);
  }

  /** Stop plugin `id` and the started plugins that need it, forget them, and drop their commands, actions and keys. Answers the ids stopped, the plugin included. */
  remove(id: string): string[] {
    const stopped: string[] = [];
    for (const p of this.started.slice()) if (p.id !== id && p.requires.includes(id)) for (const s of this.remove(p.id)) if (!stopped.includes(s)) stopped.push(s);
    for (let i = this.started.length - 1; i >= 0; i--)
      if (this.started[i].id === id) {
        this.started[i].deactivate();
        this.started.splice(i, 1);
      }
    this.plugins = this.plugins.filter((p) => p.id !== id);
    this.done.delete(id);
    this.commands.removeOwner(id);
    this.actions.removeOwner(id);
    this.keys.removeOwner(id);
    stopped.push(id);
    return stopped;
  }

  /** Start `p` after its requirements; false when it cannot start. */
  private visit(p: Plugin, visiting: Set<string>, done: Set<string>): boolean {
    if (done.has(p.id)) return this.has(p.id);
    if (visiting.has(p.id)) {
      this.problems.push(p.id + ": its requirements loop back to it");
      return false;
    }
    visiting.add(p.id);
    let ok = true;
    if (this.settings.isOff(p.id)) ok = false;
    else
      for (const id of p.requires) {
        const r = this.find(id);
        if (r === null) {
          this.problems.push(p.id + ": needs " + id + ", which is not built in");
          ok = false;
        } else if (!this.visit(r, visiting, done)) {
          this.problems.push(p.id + ": needs " + id + ", which is off");
          ok = false;
        }
        if (!ok) break;
      }
    visiting.delete(p.id);
    done.add(p.id);
    if (ok) {
      p.problem = "";
      try {
        p.activate();
      } catch (err) {
        p.problem = "activation failed: " + errorMessage(err, "error");
      }
      if (p.problem.length > 0) {
        this.problems.push(p.id + ": " + p.problem);
        this.commands.removeOwner(p.id);
        this.actions.removeOwner(p.id);
        this.keys.removeOwner(p.id);
        ok = false;
      } else this.started.push(p);
    }
    return ok;
  }

  /** Deactivate the started plugins, the last started first. */
  stop(): void {
    for (let i = this.started.length - 1; i >= 0; i--) this.started[i].deactivate();
    this.started = [];
  }
}
