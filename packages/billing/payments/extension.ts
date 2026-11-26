/**
 * @file The payments extension: `/admin/payments` and the controller behind
 * it. An app that depends on `@lightstart/billing` gets it through
 * `package.json`'s `light.extension`; an app leaves it out with
 * `extensions: { off: ["payments"] }`.
 */

import { defineExtension } from "@lightstart/app";

import payments from "./controller.ts";

export default defineExtension({
  name: "payments",
  routes: {
    "/admin/payments": { name: "payments", view: "payments-page", localized: false },
  },
  controllers: [payments],
});
