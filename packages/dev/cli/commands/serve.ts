import { defineCommand } from "@lightstart/cli";

export default defineCommand({
  description: "Serve an app in development",
  usage: "light serve [dir] [--port <n>] [--host <addr>] [--watch] [--no-check] [--build] [--open] [--tunnel] [--ephemeral]",
  aliases: ["s"],
  args: {
    dir: { positional: true, description: "Project dir (default: cwd)" },
    port: { short: "p", description: "Port to listen on" },
    host: { default: "127.0.0.1", description: "Host to bind to (0.0.0.0 for the LAN)" },
    watch: { flag: true, short: "w", description: "Watch for file changes and reload the page" },
    check: { flag: true, default: true, description: "Run light check after a watched change (--no-check turns it off)" },
    build: { flag: true, description: "Serve the latest build from .deployed/current" },
    open: { flag: true, description: "Open the page in the browser once it listens" },
    tunnel: { flag: true, description: "Expose the server through a Cloudflare tunnel" },
    ephemeral: { flag: true, description: "No pidfile; stop when LIGHT_PARENT_PID ends" },
  },
  async run(ctx, args) {
    const { startServer } = await import("../../node/index.ts");
    return await startServer(ctx, {
      dir: args.dir,
      port: args.port,
      host: args.host,
      watch: args.watch,
      check: args.check,
      build: args.build,
      open: args.open,
      tunnel: args.tunnel,
      ephemeral: args.ephemeral,
    });
  },
});
