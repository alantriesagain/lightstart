import { defineCommand } from "@lightstart/cli";

export default defineCommand({
  description: "Bake a theme's utility classes into a module",
  usage: "light classes:bake <entry> -o <file> [--scheme dark,light] [--theme <file>] [--check]",
  args: {
    entry: { positional: true, required: true, description: "The app's entry module" },
    out: { short: "o", required: true, description: "The module to write" },
    scheme: { description: "The color schemes to bake, comma-separated (dark,light)" },
    theme: { description: "A theme module to bake instead of the default preset" },
    check: { flag: true, description: "Compare with the file on disk instead of writing it" },
  },
  async run(_ctx, { entry, out, scheme, theme, check }) {
    const { bake } = await import("../../../theme/bake.js");
    const argv = [entry, "-o", out, ...(scheme ? ["--scheme", scheme] : []), ...(theme ? ["--theme", theme] : []), ...(check ? ["--check"] : [])];
    return (await bake(argv)) ? 0 : 1;
  },
});
