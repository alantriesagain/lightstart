// node-only
/**
 * @file Where the device is: the position once, coarse and recent by default,
 * and the rejection a refusal or a missing geolocation carries.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { locate } from "../locate.js";

const real = Object.getOwnPropertyDescriptor(globalThis, "navigator");
const fake = (nav: object) => Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true });

const rejectsWith = async (work: Promise<unknown>, code: number): Promise<boolean> => {
  try {
    await work;
    return false;
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error && error.code === code;
  }
};

let asked: PositionOptions | undefined;
fake({ geolocation: { getCurrentPosition: (ok2: (pos: unknown) => void, _no: unknown, options: PositionOptions) => { asked = options; ok2({ coords: { latitude: -22.9, longitude: -43.2, accuracy: 900 } }); } } });
eq("the position is answered", JSON.stringify(await locate()), JSON.stringify({ lat: -22.9, lng: -43.2, accuracy: 900 }));
eq("the fix is coarse by default", String(asked?.enableHighAccuracy), "false");
eq("the fix may be a minute old by default", String(asked?.maximumAge), "60000");

fake({ geolocation: { getCurrentPosition: (_ok: unknown, no: (error: unknown) => void) => no({ code: 1, message: "denied" }) } });
ok("a refusal rejects with its code", await rejectsWith(locate(), 1));
fake({});
ok("no geolocation rejects with code zero", await rejectsWith(locate(), 0));

if (real) Object.defineProperty(globalThis, "navigator", real);

done();
