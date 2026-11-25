/**
 * @file The page half of `@lightstart/auth`: the `auth` controller, the
 * session token helpers, and `safeNext` for a `next` after sign-in.
 */

export { default, default as auth } from "./controller.ts";
export type { AuthError, AuthResult } from "./controller.ts";
export { authFetch, authPrefix, configureAuth, readToken, TOKEN_KEY, writeToken } from "./session.ts";
export type { AuthOptions, AuthStorage } from "./session.ts";
export { safeNext } from "./next.ts";
