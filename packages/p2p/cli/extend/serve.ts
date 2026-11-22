/**
 * @file `light serve` extended by the p2p package: answer `/_relay/info` and
 * `/_relay/pair` for a project that declares `@lightstart/p2p`. The
 * `/_relay` websocket itself is a route app (`cli/routes/relay.ts`), since
 * the dev server offers upgrades to route apps and not to handled apps.
 */

import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/dev";
import { projectHasP2P } from "../project.ts";
import { relayHub } from "../relay-hub.ts";
import { relayHttp } from "../routes/relay.ts";

export default defineExtension("serve", {
  setup(ctx, _args, api) {
    if (!projectHasP2P(ctx.projectDir)) return;
    api.handle(relayHttp(relayHub(ctx.log)));
  },
});
