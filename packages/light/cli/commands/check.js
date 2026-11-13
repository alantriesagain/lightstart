import { defineCommand } from "@lightstart/cli";

export default defineCommand({
  description: "Check a project's component files against light's conventions",
  args: { args: { positional: true, rest: true, description: "The directory and options" } },
  async run(_ctx, { args }) {
    const { check } = await import("../../check/cli.js");
    return (await check(args)) ? 0 : 1;
  },
});
