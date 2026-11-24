/**
 * @file `light serve` extended by content: answer `/content/<model>.json`,
 * `/content/<model>.<locale>.json`, `/content/<model>/<slug>.json` and
 * `/content/<model>/<slug>.<locale>.json` from the source files on each
 * request, with `cache-control: no-store`. No list is cached, so a change
 * under `content/` shows on the next read.
 */

import { defineExtension } from "@lightstart/cli";
import type {} from "@lightstart/dev";
import { json } from "@lightstart/server";
import { contentList, contentLocales, contentModels, contentRow } from "../../node.ts";

const SAFE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const LOCALE = /^[a-z]{2}(?:-[A-Za-z]{2,4})?$/;

const missing = () => json({ error: "not found" }, 404).header("cache-control", "no-store");

const answer = (value: unknown) => json(value).header("cache-control", "no-store");

const splitLocale = (stem: string): { name: string; locale: string | null } => {
  const dot = stem.lastIndexOf(".");
  if (dot > 0) {
    const maybe = stem.slice(dot + 1);
    if (LOCALE.test(maybe)) return { name: stem.slice(0, dot), locale: maybe };
  }
  return { name: stem, locale: null };
};

export default defineExtension("serve", {
  async setup(ctx, _args, api) {
    api.app.get("/content/*", async (c) => {
      const rest = c.param("*") ?? "";
      const slash = rest.indexOf("/");
      const first = slash < 0 ? rest : rest.slice(0, slash);
      const later = slash < 0 ? null : rest.slice(slash + 1);
      const models = await contentModels(ctx.projectDir);
      if (later === null) {
        if (!first.endsWith(".json")) return missing();
        const head = splitLocale(first.slice(0, -".json".length));
        if (!SAFE.test(head.name)) return missing();
        const model = models.find((entry) => entry.name === head.name);
        if (model === undefined) return missing();
        if (head.locale !== null && !contentLocales(model).includes(head.locale)) return missing();
        return answer(contentList(model, head.locale ?? undefined));
      }
      if (!SAFE.test(first)) return missing();
      const model = models.find((entry) => entry.name === first);
      if (model === undefined) return missing();
      if (!later.endsWith(".json")) return missing();
      const tail = splitLocale(later.slice(0, -".json".length));
      if (!SAFE.test(tail.name)) return missing();
      if (tail.locale !== null && !contentLocales(model).includes(tail.locale)) return missing();
      const row = contentRow(model, tail.name, tail.locale ?? undefined);
      return row === null ? missing() : answer(row);
    });
  },
});
