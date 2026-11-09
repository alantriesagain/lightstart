import assert from "node:assert/strict";
import { test } from "node:test";
import { timeAgo } from "./time-ago.js";

const NOW = Date.parse("2026-09-18T12:00:00.000Z");
const ago = (/** @type {number} */ ms, /** @type {string} */ locale = "en") =>
  timeAgo(new Date(NOW - ms).toISOString(), locale, NOW);

test("picks the largest unit that fits", () => {
  assert.equal(ago(30e3), "now");
  assert.equal(ago(5 * 60e3), "5 minutes ago");
  assert.equal(ago(2 * 3600e3), "2 hours ago");
  assert.equal(ago(3 * 86400e3), "3 days ago");
  assert.equal(ago(2 * 7 * 86400e3), "2 weeks ago");
  assert.equal(ago(60 * 86400e3), "2 months ago");
  assert.equal(ago(400 * 86400e3), "last year");
});

test("speaks the reader's language, which is why it has no words of its own", () => {
  assert.equal(ago(2 * 3600e3, "pt-BR"), "há 2 horas");
  assert.equal(ago(86400e3, "pt-BR"), "ontem");
});

test("something still to come reads as ahead rather than as a negative", () => {
  assert.equal(timeAgo(new Date(NOW + 2 * 3600e3).toISOString(), "en", NOW), "in 2 hours");
});

test("a timestamp nobody can read answers nothing rather than a wrong number", () => {
  assert.equal(timeAgo("", "en", NOW), "");
  assert.equal(timeAgo("not a date", "en", NOW), "");
});
