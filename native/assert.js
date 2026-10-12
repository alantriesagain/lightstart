/**
 * @bootstrapp/light/native/assert: the checks a native test uses. Plain
 * functions that print "ok name" or "FAIL name" and exit non-zero at the
 * end, since node:test is not available under scriptc; a test runs the
 * same under `node` and `scriptc run`, and the runner diffs the output.
 */

let failures = 0;
let count = 0;

/**
 * @param {string} name
 * @param {boolean} cond
 */
export const ok = (name, cond) => {
  count++;
  if (cond) console.log("ok " + name);
  else {
    failures++;
    console.log("FAIL " + name);
  }
};

/**
 * @param {string} name
 * @param {string} actual
 * @param {string} expected
 */
export const eq = (name, actual, expected) => {
  count++;
  if (actual === expected) console.log("ok " + name);
  else {
    failures++;
    console.log("FAIL " + name + "\n  expected: " + JSON.stringify(expected) + "\n  actual:   " + JSON.stringify(actual));
  }
};

/**
 * @param {string} name
 * @param {number} actual
 * @param {number} expected
 */
export const eqn = (name, actual, expected) => {
  eq(name, String(actual), String(expected));
};

/**
 * @param {string} name
 * @param {() => void} fn
 * @param {string} contains
 */
export const throws = (name, fn, contains) => {
  count++;
  let msg = "";
  let threw = false;
  try {
    fn();
  } catch (e) {
    threw = true;
    msg = e instanceof Error ? e.message : "non-error";
  }
  if (threw && msg.includes(contains)) console.log("ok " + name);
  else {
    failures++;
    console.log("FAIL " + name + (threw ? "\n  message: " + JSON.stringify(msg) : "\n  did not throw"));
  }
};

/** Print the tally and exit non-zero when anything failed. */
export const done = () => {
  console.log("done " + String(count - failures) + "/" + String(count));
  if (failures > 0) process.exit(1);
};
