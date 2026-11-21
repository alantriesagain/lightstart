/**
 * @file `serve:file-changed`: regenerate when a file changes under
 * src/models, src/controllers or src/views (the manifest names them), under the
 * root content/ folder (a content file's rows are generated), or when
 * src/routes.ts, src/routes.js, src/app.ts or src/app.js changes.
 */

import type { CommandContext } from "@lightstart/cli";
import type { ServeFileChangedPayload } from "@lightstart/dev/hooks";
import { generate } from "../../node/generate.ts";

const watched = (path: string): boolean =>
  path === "src/app.ts" ||
  path === "src/app.js" ||
  path === "src/routes.ts" ||
  path === "src/routes.js" ||
  path.startsWith("src/models/") ||
  path.startsWith("src/controllers/") ||
  path.startsWith("src/views/") ||
  path.startsWith("content/");

export default async function (ctx: CommandContext, payload: ServeFileChangedPayload): Promise<void> {
  if (!watched(payload.path)) return;
  await generate(ctx.projectDir);
}
