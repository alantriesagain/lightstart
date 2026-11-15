import { defineCommand } from "@lightstart/cli";
import { installProject } from "../../src/commands/install.js";
import { projectOf } from "../targets.js";

export default defineCommand({
  description: "Build the native project and copy its binary into ~/.local/bin",
  usage: "light install [name] [--strip]",
  args: {
    name: { positional: true, description: "The name to install it as (default: native.binary)" },
    strip: { flag: true, description: "Drop the symbol table" },
  },
  async run(ctx, args) {
    return installProject(projectOf(ctx), args.name, args.strip);
  },
});
