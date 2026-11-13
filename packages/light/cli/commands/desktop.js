import { defineCommand } from "@lightstart/cli";
import { needsServer, serverMessage } from "../needs-server.js";

export default defineCommand({
  description: "Build and run a desktop app",
  args: { args: { positional: true, rest: true, description: "shim, smoke, build or run and its options" } },
  async run(ctx, { args }) {
    try {
      const { desktop } = await import("../../native/desktop/build.js");
      return await desktop(args);
    } catch (error) {
      if (!needsServer(error)) throw error;
      ctx.log.error(serverMessage("desktop"));
      return 1;
    }
  },
});
