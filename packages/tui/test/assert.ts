/**
 * @file Minimal test helpers: plain scripts that print "ok <name>" and exit 1 on the first failure.
 * No node:test (not available under scriptc); runs identically under `node` and `scriptc run`.
 */
let failures = 0;
let count = 0;

export function ok(name: string, cond: boolean): void {
  count++;
  if (cond) console.log("ok " + name);
  else {
    failures++;
    console.log("FAIL " + name);
  }
}

export function eq(name: string, actual: string, expected: string): void {
  count++;
  if (actual === expected) console.log("ok " + name);
  else {
    failures++;
    console.log("FAIL " + name + "\n  expected: " + JSON.stringify(expected) + "\n  actual:   " + JSON.stringify(actual));
  }
}

/**
 * A time budget of `ms` for a speed check, times $TEST_TIME_SCALE (`light-native test` sets 4 for its
 * -O0 builds; 1 by default and for OPT=release): an order of magnitude slower still fails.
 */
export function budget(ms: number): number {
  const scale = Number(process.env["TEST_TIME_SCALE"] ?? "1");
  return ms * (Number.isNaN(scale) || scale < 1 ? 1 : scale);
}

export function eqn(name: string, actual: number, expected: number): void {
  eq(name, String(actual), String(expected));
}

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
    console.log("FAIL " + name + (threw ? "\n  message: " + msg : "\n  did not throw"));
  }
}

export function done(): void {
  console.log((failures === 0 ? "PASS " : "FAIL ") + String(count - failures) + "/" + String(count));
  if (failures > 0) process.exitCode = 1;
}
