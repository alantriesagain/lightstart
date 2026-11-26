/**
 * @file What `@lightstart/billing` adds to an app's server, declared in its
 * `package.json` (`light.server`): the `charge` and `entitlement` tables and
 * the trial, entitlements and admin payments endpoints. The app hands it the
 * plans by calling `registerBilling` (from `@lightstart/billing/server`) in
 * its own server side, since a contribution cannot import the app's file.
 */

import { defineServerContribution } from "@lightstart/api/server";

import { billingEndpoints } from "./endpoints.ts";
import { billingModels } from "./models.ts";

export default defineServerContribution({
  models: billingModels,
  endpoints: () => billingEndpoints(),
});
