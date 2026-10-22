# @light/test

What a member's tests share. A test is a plain script that prints what it checks and runs under node and natively with the same output (`light-native test`).

| Module | Holds |
|---|---|
| `assert.ts` | `ok`, `eq`, `eqn`, `throws`, `done` (the summary line and the exit code), `budget(ms)` scaled by `TEST_TIME_SCALE` |
| `headless.ts` | `wait`, `until`, and `Headless(view, w, h)`: a light view mounted on a `TRoot`, laid out until its line views measured themselves, painted to a `Screen` (`screen()`, `root`, `unmount()`) |
