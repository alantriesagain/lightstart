/**
 * @file The durations and the stamp: a call's time, a running clock, a turn's footer, and a message's
 * stamp (the time, then the date month first where the locale is the US and day first elsewhere,
 * the US when no locale is set).
 *
 * The stamp's moment, 2026-03-12 09:05:07 local time, is made from its UTC reading and the zone's
 * offset then: a Date from its parts has no native lowering.
 */
import { done, eq, ok } from "@light/test/assert.ts";
import { clock, span, stamp, took } from "../duration.ts";

const utc = Date.UTC(2026, 2, 12, 9, 5, 7);
const at = utc + new Date(utc).getTimezoneOffset() * 60000;
eq("a stamp in the US: the time, then month/day/year", stamp(at, "en_US.UTF-8"), "09:05:07 03/12/2026");
eq("elsewhere: day/month/year", stamp(at, "pt_BR.UTF-8"), "09:05:07 12/03/2026");
eq("no locale set: the US", stamp(at, ""), "09:05:07 03/12/2026");
ok("without an override it reads the environment and keeps the shape", /^\d\d:\d\d:\d\d \d\d\/\d\d\/\d{4}$/.test(stamp(at)));
eq("a turn's footer: tenths under a minute, then minutes and seconds", took(1234) + " " + took(125000), "1.2s 2m 5s");
ok("a call's time and a running clock answer text", span(1500).length > 0 && clock(61000).length > 0);
done();
