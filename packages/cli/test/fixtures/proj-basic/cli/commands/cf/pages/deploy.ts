import { defineCommand } from "../../../../../../../index.ts";

export default defineCommand({
  description: "Deploy to Cloudflare Pages (test fixture)",
  run(ctx) {
    ctx.log.log("deploying...");
    return 0;
  },
});
