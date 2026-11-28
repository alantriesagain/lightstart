/**
 * @file A fake tool extension for the admin's browser test: one sidebar
 * section, one command, and a page under the admin's own layout.
 */

import { defineExtension } from "@lightstart/app";
import { navigate } from "@lightstart/app/web";
import { adminCommands, adminSections } from "../../slots.ts";
import "./tool-view.ts";

export default defineExtension({
  name: "tool",
  fills: [
    adminSections.entry({ id: "tool", title: "Tool", icon: "wrench", path: "/admin/tool" }),
    adminCommands.entry({ id: "tool-open", title: "Open tool", icon: "wrench", run: () => navigate("/admin/tool") }),
  ],
  routes: { "/admin/tool": { name: "tool-page", view: "tool-page", layout: "admin-shell" } },
});
