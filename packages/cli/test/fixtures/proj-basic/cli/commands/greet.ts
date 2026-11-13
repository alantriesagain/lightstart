import { defineCommand } from "../../../../../index.ts";

export default defineCommand({
  description: "Greets",
  aliases: ["g"],
  run() {
    return 0;
  },
});
