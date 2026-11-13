import { defineCommand } from "@lightstart/cli";

export default defineCommand({
  description: "Bake a theme's utility classes into a module",
  args: { args: { positional: true, rest: true, description: "The entry, -o file and options" } },
  async run(_ctx, { args }) {
    const { bake } = await import("../../../theme/bake.js");
    return (await bake(args)) ? 0 : 1;
  },
});
