/**
 * @file The peer relay on `light serve`: the `/_relay` websocket a browser
 * joins, and the HTTP routes that advertise the strategy and publish the
 * host's pairing payload. The socket is a route app, which is what the dev
 * server offers a websocket upgrade to first; the HTTP routes are added by
 * `cli/extend/serve.ts`. Both exist only when the project declares
 * `@lightstart/p2p`.
 */

import { App, fail, json, upgrade } from "@lightstart/server";
import { projectHasP2P } from "../project.ts";
import { relayHub, type RelayHub } from "../relay-hub.ts";

type RouteCtx = { projectDir: string; log?: { debug?: (msg: string) => void } };

const addHttp = (app: App, hub: RelayHub): App =>
  app
    .get("/_relay/info", (c) => json({ relay: true, origins: { local: `http://${c.header("host") ?? "localhost"}`, ...hub.getOrigins() } }))
    .post("/_relay/pair", async (c) => {
      const body = await c.json().catch(() => null);
      if (body === null || typeof body !== "object" || Array.isArray(body)) return fail("body needs { payload, roomId, path }", 400);
      const { payload, roomId, path } = body as Record<string, unknown>;
      if (typeof payload !== "string" || typeof roomId !== "string" || typeof path !== "string" || !path.startsWith("/")) return fail("body needs { payload, roomId, path }", 400);
      hub.setPair({ payload, roomId, path });
      return json({ ok: true });
    })
    .get("/_relay/pair", () => json(hub.getPair() ?? { payload: null, path: null }));

/** The app a new `/_relay` upgrade is offered to. */
export const relayApp = (hub: RelayHub): App =>
  new App().get("/_relay", (c) => upgrade(c, hub.channel()));

/** The HTTP routes: the relay description and the published pair payload. */
export const relayHttp = (hub: RelayHub): App => addHttp(new App(), hub);

/** Both the socket and the HTTP routes, for a project serving the hub as a library. */
export const relayApplication = (hub: RelayHub): App => addHttp(relayApp(hub), hub);

/** The relay route app for a project that declares the package; an empty app otherwise. */
export default (ctx: RouteCtx): App =>
  projectHasP2P(ctx.projectDir) ? relayApp(relayHub(ctx.log)) : new App();
