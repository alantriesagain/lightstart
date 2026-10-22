/**
 * @file What config.json says about plugins, and what plugins keep between runs. The config's "plugins"
 * object maps an id to false (switched off), true, or an object of the plugin's own settings
 * (which leaves it on); a plugin reads its object as `unknown`. Kept state is one JSON object by
 * plugin id in a file the app names (~/.widecode/state.json), read once and written whole.
 *
 * The kept state is written as text: natively, an object written by computed string keys slows
 * every call.
 */
import { errorMessage, recordOf } from "@light/lib/json.ts";
export abstract class StateFile {
  /** The file's text, "" when there is none. */
  abstract read(): string;
  abstract write(text: string): void;
}

/** A state file that keeps nothing (no store, tests). */
export class NoStateFile extends StateFile {
  text = "";

  read(): string {
    return this.text;
  }

  write(text: string): void {
    this.text = text;
  }
}


export class Settings {
  private off = new Set<string>();
  private sectionIds: string[] = [];
  private sectionValues: unknown[] = [];
  private file: StateFile = new NoStateFile();
  private stateIds: string[] = [];
  private stateValues: unknown[] = [];
  /** Why the config or the state was not used as written ("" when it was). */
  notice = "";

  /** Add a notice, keeping what was already said. */
  private warn(text: string): void {
    this.notice = this.notice.length > 0 ? this.notice + "; " + text : text;
  }

  /** Read the config's "plugins" value. */
  load(plugins: unknown): void {
    this.off = new Set<string>();
    this.sectionIds = [];
    this.sectionValues = [];
    this.notice = "";
    if (plugins === null || plugins === undefined) return;
    const entries = recordOf(plugins);
    if (entries === null) {
      this.warn("config.json: \"plugins\" is not an object; every plugin is on");
      return;
    }
    for (const id of Object.keys(entries)) {
      const v = entries[id];
      if (v === false) this.off.add(id);
      else if (recordOf(v) !== null) {
        this.sectionIds.push(id);
        this.sectionValues.push(v);
      } else if (v !== true) this.warn("config.json: plugin " + JSON.stringify(id) + " is not true, false or an object; left on");
    }
  }

  isOff(id: string): boolean {
    return this.off.has(id);
  }

  /** The ids switched off. */
  switchedOff(): Set<string> {
    const out = new Set<string>();
    for (const id of this.off) out.add(id);
    return out;
  }

  /** Plugin `id`'s settings object, null when the config gives none. */
  section(id: string): unknown {
    const at = this.sectionIds.indexOf(id);
    return at >= 0 ? this.sectionValues[at] : null;
  }

  /** Keep state in `file`; what it holds is read now. */
  useStateFile(file: StateFile): void {
    this.file = file;
    this.stateIds = [];
    this.stateValues = [];
    const text = file.read();
    if (text.length === 0) return;
    let value: unknown = null;
    try {
      value = JSON.parse(text);
    } catch {
      this.warn("the state file is not valid JSON; starting without it");
      return;
    }
    const entries = recordOf(value);
    if (entries === null) return;
    for (const id of Object.keys(entries)) {
      this.stateIds.push(id);
      this.stateValues.push(entries[id]);
    }
  }

  /** What plugin `id` kept, null for nothing. */
  state(id: string): unknown {
    const at = this.stateIds.indexOf(id);
    return at >= 0 ? this.stateValues[at] : null;
  }

  /** Keep `value` (a JSON-able literal typed `unknown`) for plugin `id`, writing the file. */
  setState(id: string, value: unknown): void {
    const at = this.stateIds.indexOf(id);
    if (at >= 0) this.stateValues[at] = value;
    else {
      this.stateIds.push(id);
      this.stateValues.push(value);
    }
    const parts: string[] = [];
    for (let i = 0; i < this.stateIds.length; i++) parts.push("  " + JSON.stringify(this.stateIds[i]) + ": " + JSON.stringify(this.stateValues[i]));
    try {
      this.file.write("{\n" + parts.join(",\n") + "\n}\n");
    } catch (err) {
      this.warn("cannot keep state: " + (errorMessage(err, "error")));
    }
  }
}
