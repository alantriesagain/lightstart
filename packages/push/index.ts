/**
 * @file @lightstart/push: push notifications through Firebase Cloud Messaging.
 * A device registers its token under the account it is signed in to, server
 * code sends with `sendPush`, and the page's `push` controller turns it on.
 */

export type {
  PushDevice,
  PushEnv,
  PushMessage,
  PushMessageFor,
  PushOutcome,
  PushPlatform,
  PushState,
  PushTarget,
} from "./types.ts";
export { default as push, configurePush, type PushOptions, type PushShell, type PushStorage } from "./page/index.ts";
export { pushReceived, pushToken } from "./page/signals.ts";
