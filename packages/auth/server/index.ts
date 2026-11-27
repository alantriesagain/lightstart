/**
 * @file `@lightstart/auth/server`: the `/api/auth` routes, the `users`,
 * `auth_codes`, `oauth_accounts`, `auth_handoffs` and `auth_code_requests`
 * server models, the caller `@lightstart/api`'s `serverApp` takes, an HS256
 * JWT, and the mailers a code goes through.
 */

export { callerFromRequest } from "./caller.ts";
export { identityNamed, registerIdentity, resetIdentities, type Identity, type IdentityAnswer } from "./identities.ts";
export { signToken, verifyToken, TOKEN_TTL_SECONDS, type TokenPayload } from "./jwt.ts";
export { consoleMailer, mailerFrom, resendMailer, type MailMessage, type Mailer, type ResendOptions } from "./mailer.ts";
export { authModels } from "./models.ts";
export { oauthEndpoints, type OAuthAccount, type OAuthOptions } from "./oauth.ts";
export { authEndpoints, CODE_TTL_MS, CODES_PER_IP, MAX_TRIES, RESEND_MS, registerAuthHooks, resetAuthHooks, type AuthHooks, type AuthOptions } from "./routes.ts";
