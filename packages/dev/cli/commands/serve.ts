import { defineCommand } from "@lightstart/cli";

export default defineCommand({
  description: "Serve an app in development",
  usage: "light serve [dir] [--port <n>] [--host <addr>] [--watch] [--build]",
  aliases: ["s"],
  args: {
    dir: { positional: true, description: "Project dir (default: cwd)" },
    port: { short: "p", description: "Port to listen on" },
    host: { default: "127.0.0.1", description: "Host to bind to (0.0.0.0 for the LAN)" },
    watch: { flag: true, short: "w", description: "Watch for file changes and reload the page" },
    build: { flag: true, description: "Serve the latest build from .deployed/current" },
  },
  async run(ctx, args) {
    const { startServer } = await import("../../node/index.ts");
    return await startServer(ctx, { dir: args.dir, port: args.port, host: args.host, watch: args.watch, build: args.build });
  },
});
