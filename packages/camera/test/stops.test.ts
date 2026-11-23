/**
 * @file The stop tables and the arithmetic and words between them.
 */

import { done, eq as rawEq, ok } from "@lightstart/test/assert.ts";

const eq = (name: string, actual: unknown, expected: unknown) => rawEq(name, String(actual), String(expected));
import { APERTURE_THIRDS, ISO_THIRDS, SHUTTER_THIRDS, clipStops, formatAperture, formatEv, formatIso, formatShutter, nearestStop, sayStops, stopsBetween } from "../lib/stops.js";

const eqn = (name: string, actual: number, expected: number) => eq(name, String(actual), String(expected));
const deep = (name: string, actual: unknown, expected: unknown) => eq(name, JSON.stringify(actual), JSON.stringify(expected));

eqn("a longer shutter gives stops of light", stopsBetween("shutter", 1 / 250, 1 / 60), Math.log2(250 / 60));
eqn("four ISO stops are four stops", Math.round(stopsBetween("iso", 100, 1600)), 4);
eqn("a wider aperture gives stops of light", Math.round(stopsBetween("aperture", 4, 1.8) * 100) / 100, 2.3);
eqn("no value gives no stops", stopsBetween("iso", 0, 100), 0);

eqn("a shutter lands on the printed stop", SHUTTER_THIRDS[nearestStop(SHUTTER_THIRDS, 0.0167)], 1 / 60);
eqn("an ISO lands on the printed stop", ISO_THIRDS[nearestStop(ISO_THIRDS, 1500)], 1600);
eqn("an aperture lands on the printed stop", APERTURE_THIRDS[nearestStop(APERTURE_THIRDS, 1.75)], 1.8);
eqn("no value finds no stop", nearestStop(ISO_THIRDS, 0), -1);

deep("a table clips to a camera's range", clipStops([100, 200, 400, 800], { min: 200, max: 400 }), [200, 400]);
eqn("a null range keeps the table", clipStops(ISO_THIRDS, null).length, ISO_THIRDS.length);

eq("a fast shutter prints as a fraction", formatShutter(1 / 60), "1/60");
eq("a slow shutter prints in seconds", formatShutter(2), '2"');
eq("a half second prints a beat", formatShutter(0.5), '0"5');
eq("an aperture prints with f/", formatAperture(1.8), "f/1.8");
eq("an auto ISO prints A", formatIso("auto"), "A");
eq("a missing ISO prints dashes", formatIso(undefined), "--");
eq("no exposure compensation prints a plus-minus zero", formatEv(0), "±0");
eq("a third over prints a third", formatEv(0.33), "+⅓");
eq("a stop and two thirds under prints as such", formatEv(-1.67), "−1⅔");
eq("two over prints two", formatEv(2), "+2");

eq("a third of a stop says so", sayStops(0.33), "a third of a stop");
eq("one stop says one", sayStops(1), "one stop");
eq("two and two thirds say so", sayStops(2.67), "two and two thirds stops");
eq("four under is four stops", sayStops(-4), "four stops");

ok("the tables carry printed stops", SHUTTER_THIRDS.length > 0 && APERTURE_THIRDS.length > 0 && ISO_THIRDS.length > 0);

done();
