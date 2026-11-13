import { defineCommand } from "../../../../../index.ts";

export default defineCommand({
  description: "Says hello",
  args: { name: { positional: true, default: "world" } },
  run(ctx, { name }) {
    ctx.log.log(`Hello, ${name}`);
    return 0;
  },
});
