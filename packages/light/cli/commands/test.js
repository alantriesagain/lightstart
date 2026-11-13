import { defineCommand } from "@lightstart/cli";
import { needsServer, serverMessage } from "../needs-server.js";

export default defineCommand({
  description: "Run browser tests in headless Chromium",
  args: {
    headed: { flag: true, description: "A visible browser" },
    timeout: { description: "How long one file may take (default: 420000ms)" },
    root: { description: "The folder to serve (default: the current folder)" },
    files: { positional: true, rest: true, description: "Test files (none: run the extension groups)" },
  },
  async run(ctx, args) {
    try {
      const { runTestCommand } = await import("../../test/cli.js");
      return (await runTestCommand(ctx, args)) ? 0 : 1;
    } catch (error) {
      if (!needsServer(error)) throw error;
      ctx.log.error(serverMessage("test"));
      return 1;
    }
  },
});
