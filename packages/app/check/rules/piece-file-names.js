import { defineRule } from "@lightstart/light/check/define.js";
import path from "node:path";

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default defineRule({
  severity: "warn",
  description: "a file under src/models, src/controllers or src/views is kebab-case",
  why: "a view's tag and a controller's name come from the file, and the generations sort and link by it, so a name with capitals or underscores reads differently across a filesystem that folds case and a URL that does not",
  check(ctx) {
    for (const file of ctx.files()) {
      if (!/^src\/(?:models|controllers|views)\//.test(file) || !/\.(js|ts)$/.test(file)) continue;
      const stem = path.posix.basename(file).replace(/\.(js|ts)$/, "");
      if (!KEBAB.test(stem))
        ctx.report({ file, offset: 0, message: `"${path.posix.basename(file)}" is not kebab-case; rename it to lowercase words joined by "-"` });
    }
  },
});
