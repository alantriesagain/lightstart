/**
 * @file @lightstart/auth: sign-in by a code mailed to an address, and a JWT
 * session. `./server` answers `/api/auth/*` and resolves the caller
 * `@lightstart/api`'s server takes; `./page` is the `auth` controller.
 */

export type { AuthUser } from "./server/types.ts";
