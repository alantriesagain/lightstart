import { defineCommand } from "@lightstart/cli";
import { needsServer, serverMessage } from "../needs-server.js";

export default defineCommand({
  description: "Run browser tests in headless Chromium",
  args: { args: { positional: true, rest: true, description: "Test files and their options" } },
  async run(ctx, { args }) {
    try {
      const { test } = await import("../../test/cli.js");
      return (await test(args)) ? 0 : 1;
    } catch (error) {
      if (!needsServer(error)) throw error;
      ctx.log.error(serverMessage("test"));
      return 1;
    }
  },
});
