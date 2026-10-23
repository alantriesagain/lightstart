/**
 * @file The checks a native test uses, light's and its packages' (`@light/test` re-exports them):
 * plain functions that print "ok <name>" or "FAIL <name>", then a tally that makes the exit code 1
 * when anything failed, since node:test is not available under scriptc. A test runs the same
 * under `node` and `scriptc run`, and the runner compares the two outputs.
 */
let failures = 0;
let count = 0;

/** Check that `cond` holds. */
export function ok(name: string, cond: boolean): void {
  count++;
  if (cond) console.log("ok " + name);
  else {
    failures++;
    console.log("FAIL " + name);
  }
}

/** Check that `actual` is `expected`, printing both when it is not. */
export function eq(name: string, actual: string, expected: string): void {
  count++;
  if (actual === expected) console.log("ok " + name);
  else {
    failures++;
    console.log("FAIL " + name + "\n  expected: " + JSON.stringify(expected) + "\n  actual:   " + JSON.stringify(actual));
  }
}

/** `eq` over numbers. */
export function eqn(name: string, actual: number, expected: number): void {
  eq(name, String(actual), String(expected));
}

/** Check that `fn` throws an error whose message contains `contains`. */
export function throws(name: string, fn: () => void, contains: string): void {
  count++;
  let msg = "";
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    msg = e instanceof Error ? e.message : String(e);
  }
  if (threw && msg.includes(contains)) console.log("ok " + name);
  else {
    failures++;
    console.log("FAIL " + name + (threw ? "\n  message: " + JSON.stringify(msg) : "\n  did not throw"));
  }
}

/**
 * A time budget of `ms` for a speed check, times $TEST_TIME_SCALE (`light-native test` sets 4 for
 * its -O0 builds; 1 by default and for OPT=release): an order of magnitude slower still fails.
 */
export function budget(ms: number): number {
  const scale = Number(process.env["TEST_TIME_SCALE"] ?? "1");
  return ms * (Number.isNaN(scale) || scale < 1 ? 1 : scale);
}

/** Print the tally, PASS or FAIL with the checks that passed, and make the exit code 1 when one failed. */
export function done(): void {
  console.log((failures === 0 ? "PASS " : "FAIL ") + String(count - failures) + "/" + String(count));
  if (failures > 0) process.exitCode = 1;
}
