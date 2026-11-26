/**
 * @file What `@lightstart/play-billing` adds to an app's server, declared in
 * its `package.json` (`light.server`): the endpoints that verify a purchase
 * with the Play Developer API, grant it through `@lightstart/billing`, follow
 * Play's real-time notifications, and hand an account the id its purchases
 * carry.
 */

import { defineEndpoint, defineServerContribution, type Endpoint } from "@lightstart/api/server";

import { accountResponse, fetchOf, notificationResponse, purchaseResponse } from "./play.ts";

import type { PlayEnv } from "../types.ts";

type Row = Record<string, unknown>;

const isRecord = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);

/** The `/api/play-*` endpoints, reading `env` for Google, the package name and the RTDN token. */
export const playEndpoints = (env: PlayEnv): Endpoint[] => [
  defineEndpoint({
    path: "/api/play-account",
    method: "GET",
    access: "auth",
    handler: async ({ caller }) => accountResponse(caller?.id ?? "", env),
  }),

  defineEndpoint({
    path: "/api/play-purchase",
    method: "POST",
    access: "auth",
    handler: async ({ caller, body, db }) => {
      const payload = isRecord(body) ? body : {};
      return purchaseResponse(db, { user: caller === null ? null : { id: caller.id }, body: payload, env, fetchImpl: fetchOf(env) });
    },
  }),

  defineEndpoint({
    path: "/api/play-rtdn",
    method: "POST",
    access: "public",
    handler: async ({ body, query, db }) => {
      const payload = isRecord(body) ? body : {};
      return notificationResponse(db, { body: payload, token: String(query["token"] ?? ""), env, fetchImpl: fetchOf(env) });
    },
  }),
];

export default defineServerContribution({
  endpoints: (env) => playEndpoints(env as PlayEnv),
});
