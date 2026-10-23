/**
 * @file The checks a member's test uses: light's own (`native/assert.ts`), which print "ok <name>"
 * or "FAIL <name>" and end with a tally, the same under `node` and `scriptc run`; `budget` scales a
 * speed check's time for the build being tested.
 */
export { budget, done, eq, eqn, ok, throws } from "@bootstrapp/light/native/assert.ts";
