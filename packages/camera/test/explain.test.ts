/**
 * @file The lesson a shot or a clip carries: who set what, and what it did.
 */

import { done, eq as rawEq, ok } from "@lightstart/test/assert.ts";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
import { explain, explainExposure, explainVideo, shotLine } from "../lib/explain.js";

const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));

{
  const { headline, lines } = explainExposure({ mode: "m", shutter: 1 / 60, aperture: 1.8, iso: 1600, lens: 26 });
  eq("M names what you set and what the light asked", headline, "You set 1/60 and f/1.8, so ISO 1600 is what the light asked for.");
  ok("M says how far over base the ISO is", lines.some((line) => line.startsWith("ISO 1600 is four stops over base")));
  ok("M says what half the ISO would have needed", lines.includes("At ISO 800 the same frame would have needed 1/30."));
}

{
  const { headline, lines } = explainExposure({ mode: "tv", shutter: 1 / 1000, aperture: 1.8, iso: 400, lens: 52, metered: { shutter: 1 / 250 } });
  eq("Tv names the shutter you set and the camera's answer", headline, "You set 1/1000. The camera answered with f/1.8 and ISO 400.");
  ok("Tv reads the meter's shutter", lines.some((line) => line.includes("two stops faster than the light wanted")));
}

{
  const { headline } = explainExposure({ mode: "av", shutter: 1 / 250, aperture: 1.8, iso: 100, fixedAperture: true });
  ok("Av on a fixed lens says it is fixed", /fixed at/.test(headline));
}

ok("the 180 degree rule is understood", /180° rule/.test(explainVideo({ fps: 30, shutter: 1 / 60 }).headline));
ok("a fast shutter stutters", /43° shutter.*stutters/.test(explainVideo({ fps: 30, shutter: 1 / 250 }).headline));
ok("a slow shutter smears", /360° shutter.*smears/.test(explainVideo({ fps: 30, shutter: 1 / 30 }).headline));
eq("the 180 degree shutter at 60 frames", explainVideo({ fps: 60, shutter: 1 / 120 }).lines[0], "For the 180° look at 60 frames the shutter is 1/120.");
ok("the explainer routes a clip by kind", /180°/.test(explain("video", { fps: 30, shutter: 1 / 60 }).headline));
deep("the shot line reads the settings", shotLine({ mode: "m", shutter: 1 / 60, aperture: 1.8, iso: 1600, lens: 26 }), ["M", "1/60", "f/1.8", "ISO 1600", "26mm"]);

done();
