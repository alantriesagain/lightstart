import { defineCommand } from "@lightstart/cli";
import { needsServer, serverMessage } from "../needs-server.js";

export default defineCommand({
  description: "Serve an app in development",
  args: { args: { positional: true, rest: true, description: "The directory and options" } },
  async run(ctx, { args }) {
    try {
      const { serveCommand } = await import("../../test/serve.js");
      return await serveCommand(args);
    } catch (error) {
      if (!needsServer(error)) throw error;
      ctx.log.error(serverMessage("serve"));
      return 1;
    }
  },
});
