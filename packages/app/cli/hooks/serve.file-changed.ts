/**
 * @file `serve:file-changed`: regenerate when a file changes under `src/` (the
 * manifest names models, controllers and views, and any source can carry an
 * icon name or a component tag) or under the root `content/` folder (a content
 * file's rows are generated).
 */

import type { CommandContext } from "@lightstart/cli";
import type { ServeFileChangedPayload } from "@lightstart/dev/hooks";
import { generate } from "../../node/generate.ts";

const watched = (path: string): boolean => path.startsWith("src/") || path.startsWith("content/");

export default async function (ctx: CommandContext, payload: ServeFileChangedPayload): Promise<void> {
  if (!watched(payload.path)) return;
  await generate(ctx.projectDir);
}
