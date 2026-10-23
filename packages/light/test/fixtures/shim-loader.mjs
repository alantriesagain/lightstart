/**
 * A module-resolution hook that points `node:test` and `node:assert/strict` at
 * the browser shims, so a fixture written for node runs unmodified against
 * them. This is the parity oracle's mechanism; it is test-only.
 */
const SHIMS = {
  "node:test": new URL("../node-test.js", import.meta.url).href,
  "node:assert/strict": new URL("../node-assert-strict.js", import.meta.url).href,
  "node:assert": new URL("../node-assert.js", import.meta.url).href,
};

export const resolve = (specifier, context, nextResolve) => {
  const shim = SHIMS[specifier];
  if (shim) return { url: shim, shortCircuit: true };
  return nextResolve(specifier, context);
};
