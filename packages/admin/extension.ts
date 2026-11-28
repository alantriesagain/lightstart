/**
 * @file The admin as an `@lightstart/app` extension: `/admin` in its own
 * shell. A tool adds routes under `/admin/...` with the same layout and fills
 * `adminSections` and `adminCommands`.
 */

import { defineExtension } from "@lightstart/app";

export default defineExtension({
  name: "admin",
  routes: {
    "/admin": { name: "admin-home", view: "admin-home", layout: "admin-shell" },
  },
});
