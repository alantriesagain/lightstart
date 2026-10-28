/**
 * @file A plugin: one feature of a server as a unit that can be left out (CORS, static files, a
 * proxy's trust, a set of endpoints). It is made with its options and contributes in `setup`,
 * through the app it is handed: routes, middleware, hooks, a mounted app. The app sets its plugins
 * up when it is built, each after the plugins its `requires` names, in the order they were added
 * otherwise; a requirement no plugin meets, or a loop, refuses the build.
 */
import type { App } from "./app.ts";

export abstract class Plugin {
  /** The name other plugins require it by ("cors"). */
  readonly id: string;
  /** The plugins that must be set up before this one. */
  readonly requires: string[];

  constructor(id: string, requires: string[]) {
    this.id = id;
    this.requires = requires;
  }

  abstract setup(app: App): void;
}

/**
 * `plugins` in the order their requirements allow, else the order given; throws on a missing
 * requirement or a loop. The same plugin may be added more than once (two static folders); a
 * requirement is met once every plugin of that id is set up.
 */
export const ordered = (plugins: Plugin[]): Plugin[] => {
  const ids: string[] = [];
  for (const p of plugins) ids.push(p.id);
  for (const p of plugins)
    for (const r of p.requires) if (ids.indexOf(r) < 0) throw new Error("plugin " + p.id + " requires " + r + ", which was not added");
  const out: Plugin[] = [];
  const started: boolean[] = [];
  for (let i = 0; i < plugins.length; i++) started.push(false);
  const met = (id: string): boolean => {
    for (let i = 0; i < plugins.length; i++) if (ids[i] === id && !started[i]) return false;
    return true;
  };
  while (out.length < plugins.length) {
    let progressed = false;
    for (let i = 0; i < plugins.length; i++) {
      if (started[i]) continue;
      const p = plugins[i]!;
      let ready = true;
      for (const r of p.requires) if (!met(r)) ready = false;
      if (ready) {
        out.push(p);
        started[i] = true;
        progressed = true;
      }
    }
    if (!progressed) {
      const stuck: string[] = [];
      for (let i = 0; i < plugins.length; i++) if (!started[i]) stuck.push(ids[i]!);
      throw new Error("plugins " + stuck.join(", ") + " require each other");
    }
  }
  return out;
};
