/**
 * @file A plugin: one feature of an app as a unit that can be left out. It is made with what it needs
 * (the host, usually) and registers what it contributes in `activate`: commands and keys through
 * the kernel, columns, tabs, status segments and band parts through the host. `deactivate` undoes
 * whatever outlives the screen (timers, processes). The kernel activates plugins in the order of
 * their requirements and skips the ones switched off in config.json. A plugin with settings reads
 * its section of the config in `activate` and answers its defaults, which a new config.json lists.
 */
export abstract class Plugin {
  /** The name config.json and other plugins know it by ("git"). */
  readonly id: string;
  /** Plugins that must be on for this one to start; they are activated first. */
  readonly requires: string[];
  /** Why its activation failed ("" when it did not): the kernel then counts it as not started. */
  problem = "";

  constructor(id: string, requires: string[]) {
    this.id = id;
    this.requires = requires;
  }

  activate(): void {}

  deactivate(): void {}

  /** Its section as a new config.json gets it: true (on, no settings) unless it has settings. */
  defaults(): unknown {
    const v: unknown = true;
    return v;
  }
}
