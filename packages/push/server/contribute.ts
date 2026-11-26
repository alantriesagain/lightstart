/**
 * @file The package's part of an app's server: the `push_device` table and
 * `POST /api/push-device`. Its `package.json` names this file as
 * `light.server`, so a migration creates the table and the generated server
 * registers the endpoint.
 */

import { defineServerContribution } from "@lightstart/api/server";
import { pushEndpoints } from "./device.ts";
import { pushModels } from "./models.ts";

/** `@lightstart/push`'s part of the server: its table and its one endpoint. */
export const pushContribution = defineServerContribution({
  models: pushModels,
  endpoints: () => pushEndpoints,
});

export default pushContribution;
