/**
 * @file `light new`: the static command the `light` binary registers. It names a kind, a name and
 * where to write, then hands the work to the generator. It imports the CLI only as a type, so the
 * package has no runtime dependency on @lightstart/cli.
 */
import { resolve } from "node:path";
import type { ArgsSchema, Command, ResolvedArgs } from "@lightstart/cli";
import { generate, resolveCheckout } from "./generate.ts";
import type { InstallMode, PackageManager } from "./generate.ts";
import { KINDS, kindByName } from "./kinds.ts";

const args = {
  kind: { positional: true, description: "web, tui, desktop or package" },
  name: { positional: true, description: "The package name, and the folder when --dir is not given" },
  dir: { description: "The folder to write (default: ./<name>)" },
  light: { description: "The light checkout to link (default: the one this CLI runs from)" },
  npm: { flag: true, description: "Write published versions instead of linking; the install may fail until they are published" },
  pm: { choices: ["pnpm", "npm"] as const, description: "The package manager (default: pnpm, or npm with --npm)" },
  install: { flag: true, default: true, description: "Run the install (--no-install keeps it off)" },
  force: { flag: true, description: "Write into a folder that is not empty" },
} as const satisfies ArgsSchema;

const command: Command<typeof args> = {
  description: "Start a project on light",
  usage: "light new <kind> <name> [--dir <path>] [--light <path>] [--npm] [--pm pnpm|npm] [--no-install] [--force]",
  args,
  async run(ctx, parsed: ResolvedArgs<typeof args>) {
    if (parsed.kind === undefined) {
      for (const kind of KINDS) ctx.log.log(`${kind.name.padEnd(10)}${kind.description}`);
      return 0;
    }
    const kind = kindByName(parsed.kind);
    if (kind === undefined) {
      ctx.log.error(`Unknown kind "${parsed.kind}". The kinds are ${KINDS.map((entry) => entry.name).join(", ")}.`);
      return 2;
    }
    if (parsed.name === undefined) {
      ctx.log.error(`light new ${kind.name} needs a name.`);
      return 2;
    }
    const mode: InstallMode = parsed.npm ? "npm" : parsed.pm === "npm" ? "file" : "link";
    const pm: PackageManager = parsed.pm ?? (parsed.npm ? "npm" : "pnpm");
    try {
      const lightRoot = resolveCheckout(parsed.light);
      const target = resolve(ctx.cwd, parsed.dir ?? parsed.name);
      const manifest = await generate({
        kind,
        name: parsed.name,
        target,
        lightRoot,
        mode,
        pm,
        install: parsed.install,
        force: parsed.force,
        log: (message) => ctx.log.log(message),
      });
      ctx.log.log(`Created ${manifest.name} from the ${kind.name} kind.`);
      ctx.log.log(`Next: cd ${target}${parsed.install ? "" : ` && ${pm} install`} && ${pm} run ${kind.next ?? "dev"}`);
      return 0;
    } catch (error) {
      ctx.log.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  },
};

export default command;
