/** @file getComponentList: the tags table grouped by the folder each component's module lives in. */
import { done, same, test } from "./check.ts";
import { getComponentList } from "../lib/registry.ts";
import type { ComponentTag, ComponentTags } from "../lib/types.ts";

const tag = (module: string): ComponentTag => ({
  module,
  style: null,
  extends: null,
  uses: [],
  doc: { description: "", parts: [], slots: [] },
});

test("groups components by the directory each one lives in", () => {
  const tags: ComponentTags = {
    "lc-button": tag("display/button.js"),
    "lc-badge": tag("display/badge.js"),
    "lc-modal": tag("overlay/modal.js"),
  };
  same(getComponentList(tags), { display: ["button", "badge"], overlay: ["modal"] });
});

test("takes the name of a tag without its lc- prefix", () => {
  const tags: ComponentTags = { "lc-button": tag("display/button.js") };
  same(getComponentList(tags), { display: ["button"] });
});

test("answers empty when the tags table is empty", () => {
  same(getComponentList({}), {});
});
done();
