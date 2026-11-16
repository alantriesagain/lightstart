/**
 * @file `serve:file-changed`: regenerate when a file the manifest names is
 * added, removed or renamed under src/models, src/controllers, src/views, or
 * when src/routes.ts or src/app.ts changes.
 */

import type { CommandContext } from "@lightstart/cli";
import type { ServeFileChangedPayload } from "@lightstart/dev/hooks";
import { generate } from "../../node/generate.ts";

const watched = (path: string): boolean =>
  path === "src/app.ts" ||
  path === "src/routes.ts" ||
  path.startsWith("src/models/") ||
  path.startsWith("src/controllers/") ||
  path.startsWith("src/views/");

export default async function (ctx: CommandContext, payload: ServeFileChangedPayload): Promise<void> {
  if (!watched(payload.path)) return;
  await generate(ctx.projectDir);
}
