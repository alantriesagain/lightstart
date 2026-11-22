/**
 * @file `serve:after`: tell the relay hub where phones can reach this
 * server, and close the hub with the server. Only a project that declares
 * `@lightstart/p2p` gets a relay. There is no terminal QR: light has no QR
 * package yet, so the printed LAN and tunnel origins are the pairing hint.
 */

import type { Hooks } from "@lightstart/cli";
import type {} from "@lightstart/dev";
import { projectHasP2P } from "../project.ts";
import { relayHub } from "../relay-hub.ts";

const hook: Hooks["serve:after"] = (ctx, { projectDir, origins }) => {
  if (!projectHasP2P(projectDir)) return;
  const hub = relayHub(ctx.log);
  hub.setOrigins({ ...(origins.lan ? { lan: origins.lan } : {}), ...(origins.tunnel ? { tunnel: origins.tunnel } : {}) });
  for (const origin of [origins.lan, origins.tunnel])
    if (origin) ctx.log.log(`P2P relay ready at ${origin}/`);
  return () => hub.close();
};

export default hook;
