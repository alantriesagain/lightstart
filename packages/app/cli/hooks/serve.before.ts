/**
 * @file `serve:before`: generate the app before `light serve` starts, so the
 * page's `.light/main.ts` and every tag it needs exist.
 */

import type { CommandContext } from "@lightstart/cli";
import type { ServeBeforePayload } from "@lightstart/dev/hooks";
import { generate } from "../../node/generate.ts";

export default async function (ctx: CommandContext, _payload: ServeBeforePayload): Promise<void> {
  await generate(ctx.projectDir);
}
