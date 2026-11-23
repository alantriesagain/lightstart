// node-only
/**
 * @file Camera-reported availability crossed with our setting names.
 */

import { done, eq as rawEq } from "@lightstart/test/assert.ts";
import { buildControls, settingIdFor } from "../lib/settings.js";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));

{
  const controls = buildControls({ 2: [1, 9], 121: [0, 4] }, { 2: 9, 121: 0 }, "video");
  const resolution = controls.find((c) => c.id === "resolution");
  deep("buildControls names the option ids", resolution?.options, [
    { value: 1, label: "4K" },
    { value: 9, label: "1080p" },
  ]);
  eq("buildControls reports the current value", resolution?.value, 9);
}

{
  const controls = buildControls({ 2: [9] }, { 2: 9 }, "video");
  deep("buildControls offers only what the camera blessed", controls.find((c) => c.id === "resolution")?.options.map((o) => o.value), [9]);
}

deep("buildControls drops a setting with no options", buildControls({ 2: [9], 3: [] }, { 2: 9 }, "video").map((c) => c.id), ["resolution"]);

{
  const controls = buildControls({ 2: [9, 247] }, { 2: 247 }, "video");
  const resolution = controls.find((c) => c.id === "resolution");
  deep("buildControls keeps an unnamed option", resolution?.options[1], { value: 247, label: "#247" });
  eq("buildControls keeps an unnamed value selected", resolution?.value, 247);
}

{
  const video = buildControls({ 121: [0, 4], 122: [101, 102] }, {}, "video");
  const photo = buildControls({ 121: [0, 4], 122: [101, 102] }, {}, "photo");
  deep("buildControls scopes video settings", video.map((c) => c.id), ["lens"]);
  deep("buildControls names the video lens options", video[0].options.map((o) => o.label), ["Wide", "Linear"]);
  deep("buildControls scopes photo settings", photo.map((c) => c.id), ["lens"]);
  deep("buildControls names the photo lens options", photo[0].options.map((o) => o.label), ["Wide", "Linear"]);
}

{
  const [lens] = buildControls({ 121: [0] }, {}, "video");
  eq("buildControls marks the lens as changing the preview", lens.affectsPreview, true);
  const [resolution] = buildControls({ 2: [9] }, {}, "video");
  eq("buildControls leaves resolution alone", resolution.affectsPreview, undefined);
}

eq("settingIdFor resolves the video lens", settingIdFor("lens", "video"), 121);
eq("settingIdFor resolves the photo lens", settingIdFor("lens", "photo"), 122);
eq("settingIdFor refuses an unknown control", settingIdFor("nope", "video"), undefined);

{
  const [fps] = buildControls({ 3: [5, 8, 1, 5, 8] }, { 3: 8 }, "video");
  deep("buildControls collapses a repeated option", fps.options.map((o) => o.value), [5, 8, 1]);
}

done();
