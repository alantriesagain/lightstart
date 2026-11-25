# @lightstart/test

What a member's tests share. A test is a plain script that prints what it checks and runs under node and natively with the same output (`light test`).

| Module | Holds |
|---|---|
| `assert.ts` | `ok`, `eq`, `eqn`, `throws`, `done` (the summary line and the exit code), `budget(ms)` scaled by `TEST_TIME_SCALE`; light's own `arm()` (in `@lightstart/light/native/assert.ts`, for `light test`'s batches, not for tests) starts the tally again and resolves on the next `done()` |
| `headless.ts` | `wait`, `until`, and `Headless(view, w, h)`: a light view mounted on a `TRoot`, laid out until its line views measured themselves, painted to a `Screen` (`screen()`, `root`, `unmount()`) |
