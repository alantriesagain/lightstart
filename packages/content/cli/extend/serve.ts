/**
 * @file `light serve` extended by content: answer `/content/<model>.json` and
 * `/content/<model>/<slug>.json` from the Markdown files on each request,
 * with `cache-control: no-store`. No list is cached, so a change under
 * `content/` shows on the next read.
 */

import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/dev";
import { json } from "@lightstart/server";
import { contentList, contentModels, contentRow } from "../../node.ts";

const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const missing = () => json({ error: "not found" }, 404).header("cache-control", "no-store");

const answer = (value: unknown) => json(value).header("cache-control", "no-store");

export default defineExtension("serve", {
  async setup(ctx, _args, api) {
    api.app.get("/content/*", async (c) => {
      const rest = c.param("*") ?? "";
      const slash = rest.indexOf("/");
      const first = slash < 0 ? rest : rest.slice(0, slash);
      const later = slash < 0 ? null : rest.slice(slash + 1);
      if (!first.endsWith(".json")) return missing();
      const name = first.slice(0, -".json".length);
      if (!SAFE.test(name)) return missing();
      const models = await contentModels(ctx.projectDir);
      const model = models.find((entry) => entry.name === name);
      if (model === undefined) return missing();
      if (later === null) return answer(contentList(model));
      if (!later.endsWith(".json")) return missing();
      const slug = later.slice(0, -".json".length);
      if (!SAFE.test(slug)) return missing();
      const row = contentRow(model, slug);
      return row === null ? missing() : answer(row);
    });
  },
});
