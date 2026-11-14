import { defineCommand } from "@lightstart/cli";
import { needsServer, serverMessage } from "../needs-server.js";

export default defineCommand({
  description: "Build and run a desktop app",
  args: {
    command: { positional: true, description: "shim, smoke, build, run or dev" },
    rest: { positional: true, rest: true, description: "The subcommand's arguments" },
    target: { description: "linux, mac or win (default: linux)" },
    wait: { flag: true, description: "smoke: keep the window until it is closed" },
    web: { description: "build/run: the page folder" },
    out: { description: "build/run: the output folder" },
    name: { description: "build/run: the executable name" },
    "keep-light": { flag: true, description: "build/run: reuse light's staged files" },
    "no-web": { flag: true, description: "build/run: build only the executable" },
    "npm-static": { description: "build/run: a package the backend imports bare" },
    port: { description: "dev: the port to serve on" },
    attach: { flag: true, description: "dev: reuse a server already answering" },
  },
  async run(ctx, args) {
    try {
      const { desktop } = await import("../../native/desktop/build.js");
      return await desktop(ctx.argv, { ctx, args });
    } catch (error) {
      if (!needsServer(error)) throw error;
      ctx.log.error(serverMessage("desktop"));
      return 1;
    }
  },
});
