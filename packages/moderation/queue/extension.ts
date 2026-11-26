/**
 * @file The review queue extension: `/admin/queue` and the controller behind
 * it, plus the queue kind this package owns (a profile photo). An app that
 * depends on `@lightstart/moderation` gets it through `package.json`'s
 * `light.extension`; an app leaves it out with `extensions: { off:
 * ["moderation"] }`.
 */

import { defineExtension } from "@lightstart/app";

import moderationQueue from "./controller.ts";
import { queueKinds } from "./slots.ts";

export default defineExtension({
  name: "moderation",
  routes: {
    "/admin/queue": { name: "moderation-queue", view: "moderation-queue", localized: false },
  },
  controllers: [moderationQueue],
  fills: [
    queueKinds.entry({
      kind: "avatar",
      label: "Profile photo",
      group: "Reviews and photos",
      icon: "user-round",
      detail: "moderation-queue-photo",
      title: () => "Profile photo",
    }),
  ],
});
