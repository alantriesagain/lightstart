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

/** `plugins` in the order their requirements allow, else the order given; throws on a missing requirement or a loop. */
export const ordered = (plugins: Plugin[]): Plugin[] => {
  const out: Plugin[] = [];
  const ids: string[] = [];
  for (const p of plugins) ids.push(p.id);
  for (const p of plugins)
    for (const r of p.requires) if (ids.indexOf(r) < 0) throw new Error("plugin " + p.id + " requires " + r + ", which was not added");
  const done: string[] = [];
  while (out.length < plugins.length) {
    let progressed = false;
    for (const p of plugins) {
      if (done.indexOf(p.id) >= 0) continue;
      let ready = true;
      for (const r of p.requires) if (done.indexOf(r) < 0) ready = false;
      if (ready) {
        out.push(p);
        done.push(p.id);
        progressed = true;
      }
    }
    if (!progressed) {
      const stuck: string[] = [];
      for (const p of plugins) if (done.indexOf(p.id) < 0) stuck.push(p.id);
      throw new Error("plugins " + stuck.join(", ") + " require each other");
    }
  }
  return out;
};
