/**
 * @file The package's part of an app's server, named by `light.server` in
 * `package.json`: `POST /api/pix/charge`, which records a charge through
 * `@lightstart/billing` and answers it with its BR Code. The tables the charge
 * lives in come from billing's own contribution, which the app declares too.
 */

import { defineServerContribution } from "@lightstart/api/server";

import { pixEndpoints } from "./charge.ts";

/** `@lightstart/pix`'s part of the server: its one endpoint. */
export const pixContribution = defineServerContribution({
  endpoints: () => pixEndpoints,
});

export default pixContribution;
