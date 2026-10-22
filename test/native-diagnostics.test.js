/**
 * The native gate's reading of scriptc's JSON coverage report: which diagnostics fail it, the
 * divergence allowlist, the baseline ratchet, and the line each finding prints as. The reports are
 * written here in scriptc's schema, so the test needs no compiler.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classify, formatDiagnostic, gate } from "../native/diagnostics.js";

/** @typedef {import("../native/diagnostics.js").Diagnostic} Diagnostic */

/** @param {Partial<Diagnostic>} fields @returns {Diagnostic} */
const diagnostic = (fields) => ({
  code: "SC1090",
  category: "unsupported",
  severity: "error",
  scope: "reached",
  file: "/repo/html/parts.ts",
  line: 10,
  column: 3,
  message: "something is not supported yet",
  hint: "",
  group: "SC1090-aaaa",
  ...fields,
});

/** @param {Diagnostic[]} diagnostics @param {{ total?: number, static?: number, failed?: number }} [counts] */
const report = (diagnostics, counts = {}) => ({
  schema: "scriptc-diagnostics",
  schemaVersion: 1,
  compilerVersion: "0.3.6",
  entry: "native/index.js",
  success: true,
  stats: { statementsTotal: counts.total ?? 100, statementsStatic: counts.static ?? 100, statementsFailed: counts.failed ?? 0, functionsSkipped: 0, percentStatic: 100 },
  diagnostics,
});

const slowPath = diagnostic({ code: "SC7001", category: "slow-path", severity: "warning", message: "this write's key can name any property", hint: "type the key as a number", group: "SC7001-bbbb" });
const divergence = diagnostic({ code: "SC6001", category: "divergence", severity: "warning", group: "SC6001-cccc" });
const deferred = diagnostic({ scope: "deferred", group: "SC1090-dddd" });

describe("the native coverage gate", () => {
  it("passes a fully static report with nothing in it", () => {
    const result = gate(classify(report([])));
    assert.equal(result.pass, true);
    assert.deepEqual(result.failures, []);
  });

  it("fails on a blocker and on a slow path, whatever the dynamic allowance", () => {
    for (const allowDynamic of [false, true]) {
      const result = gate(classify(report([diagnostic({}), slowPath])), { allowDynamic });
      assert.equal(result.pass, false);
      assert.deepEqual(result.failures.map((d) => d.code), ["SC1090", "SC7001"]);
    }
  });

  it("tells a slow path by its category, not its code", () => {
    const contract = diagnostic({ code: "SC7001", category: "unsupported", message: "a NoThrow contract does not hold" });
    const coverage = classify(report([contract]));
    assert.deepEqual(coverage.slowPaths, []);
    assert.deepEqual(coverage.blockers, [contract]);
  });

  it("fails on deferred statements and on a static share under 100% unless dynamic code is allowed", () => {
    const coverage = classify(report([deferred], { static: 90 }));
    assert.equal(gate(coverage).pass, false);
    assert.deepEqual(gate(coverage).failures, [deferred]);
    assert.equal(gate(coverage, { allowDynamic: true }).pass, true);
  });

  it("fails on a divergence unless its group is allowed, and notes an allowed group no longer reported", () => {
    const coverage = classify(report([divergence]));
    assert.equal(gate(coverage).pass, false);
    const allowed = gate(coverage, { divergences: { "SC6001-cccc": "the native error message names the path" } });
    assert.equal(allowed.pass, true);
    const stale = gate(classify(report([])), { divergences: { "SC6001-cccc": "gone" } });
    assert.equal(stale.pass, true);
    assert.match(stale.notes[0], /SC6001-cccc is allowed but no longer reported/);
  });

  it("holds the failed and deferred counts to the baseline, and asks to lower it when they drop", () => {
    const coverage = classify(report([deferred, deferred], { static: 95, failed: 3 }));
    assert.equal(gate(coverage, { allowDynamic: true, baseline: { failed: 3, deferred: 2 } }).pass, true);
    assert.equal(gate(coverage, { allowDynamic: true, baseline: { failed: 2, deferred: 2 } }).pass, false);
    assert.equal(gate(coverage, { allowDynamic: true, baseline: { failed: 3, deferred: 1 } }).pass, false);
    const lower = gate(coverage, { allowDynamic: true, baseline: { failed: 5, deferred: 2 } });
    assert.equal(lower.pass, true);
    assert.match(lower.notes[0], /lower it/);
  });

  it("refuses a report in another schema", () => {
    assert.throws(() => classify({ ...report([]), schemaVersion: 2 }), /unexpected scriptc report/);
  });

  it("prints a finding as file:line:col, code and message, then its hint", () => {
    assert.equal(formatDiagnostic(slowPath, "/repo"), "html/parts.ts:10:3 SC7001 this write's key can name any property\n    hint: type the key as a number");
  });
});
