/**
 * @file The checks these tests write, over `@lightstart/test`'s `ok` and `eq` so they print the same
 * lines under node and natively: `test` names the checks it runs, `assert.equal`, `assert.ok` and
 * `assert.match` check one value, and `same` compares two values as their JSON. A body may be async;
 * a test that awaits one leaves its top-level statement awaiting too.
 */
import { done, eq, ok } from "@lightstart/test/assert.ts";

let current = "";

const label = (message?: string): string => (message === undefined ? current : current + ": " + message);

const text = (value: unknown): string => String(JSON.stringify(value));

/** Run the checks `body` makes, under `name`. */
export const test = (name: string, body: () => void | Promise<void>): void | Promise<void> => {
  current = name;
  return body();
};

/** One value checked: equal to another, true, or matching a pattern. */
class Check {
  equal(actual: unknown, expected: unknown, message?: string): void {
    eq(label(message), text(actual), text(expected));
  }

  ok(value: boolean, message?: string): void {
    ok(label(message), value);
  }

  match(value: string, pattern: RegExp, message?: string): void {
    ok(label(message), pattern.test(value));
  }
}

export const assert = new Check();

/** Whether `actual` and `expected` print the same JSON. */
export const same = (actual: unknown, expected: unknown, message?: string): void => {
  eq(label(message), text(actual), text(expected));
};

export { done };
