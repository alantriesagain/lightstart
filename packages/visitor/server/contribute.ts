/**
 * @file The package's part of an app's server: the `visits` table a
 * per-address limit counts. `package.json` names this file as `light.server`,
 * so a migration creates the table in the app's database.
 */

import { defineServerContribution } from "@lightstart/api/server";
import { visitorModels } from "./models.ts";

/** `@lightstart/visitor`'s part of the server: its table, and no endpoints or caller. */
export const visitorContribution = defineServerContribution({ models: visitorModels });

export default visitorContribution;
