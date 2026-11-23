/**
 * @file The names Canon and Nikon print, and the mode table.
 */

import { done, eq as rawEq, ok } from "@lightstart/test/assert.ts";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
import { BODIES, MODE_ORDER, modeAside, modeLabel, modeLine, placement } from "../lib/bodies.js";
import { availability, settable } from "../lib/exposure-modes.js";

const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));

const BODY_IDS: ReadonlyArray<import("../lib/bodies.js").BodyId> = ["canon", "nikon"];
for (const body of BODY_IDS) for (const mode of MODE_ORDER) ok(`${body} names the ${mode} mode`, Boolean(modeLabel(body, mode)));
eq("Canon prints Av", modeLabel("canon", "av"), "Av");
eq("Nikon prints A", modeLabel("nikon", "av"), "A");
eq("the other body's word for Av", modeAside("canon", "av"), "A Nikon calls it A.");
eq("M is M on both", modeAside("canon", "m"), "");
ok("a mode line names the other body's word", /^You set the shutter, ISO follows the light\. A Canon calls it Tv\.$/.test(modeLine("nikon", "tv")));
eq("a mode line without the aside", modeLine("nikon", "tv", { aside: false }), "You set the shutter, ISO follows the light.");
deep("the fixed lens menu order", MODE_ORDER, ["auto", "p", "tv", "m"]);
ok("the shutter sits on the main dial", placement("canon", "shutter").includes("Main dial"));
eq("there are two bodies", String(Object.keys(BODIES).length), "2");

eq("auto leaves the shutter to the camera", availability("auto", "shutter"), "auto");
eq("Tv makes the shutter yours", availability("tv", "shutter"), "set");
eq("Tv leaves the aperture to the camera", availability("tv", "aperture"), "auto");
eq("a fixed lens locks the aperture in M", availability("m", "aperture", { fixedAperture: true }), "locked");
eq("an auto ISO in Tv is the camera's", availability("tv", "iso", { autoIso: true }), "auto");
eq("bulb hides the shutter", availability("b", "shutter"), "hidden");
deep("a fixed lens leaves Av four cells", settable("av", { fixedAperture: true }), ["mode", "iso", "ev", "focus"]);
eq("auto leaves the focus to the camera", availability("auto", "focus"), "auto");
eq("M makes the focus yours", availability("m", "focus"), "set");
deep("auto has one cell to turn", settable("auto"), ["mode"]);

done();
