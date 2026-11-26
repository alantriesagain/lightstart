/**
 * @file What @lightstart/push hands around: where a push goes, what it says,
 * what the sender did, and where a device stands.
 */

/** The platforms a device can register from. */
export type PushPlatform = "android" | "ios";

/** Where a push goes: every device signed in to an account, or one device by the id it registered under. */
export type PushTarget = { userId: string } | { deviceId: string };

/**
 * What a push says. `id` names the thing it is about, so a device shows one
 * line per id however often it arrives; `url` is the path a tap opens.
 */
export interface PushMessage {
  id: string;
  title: string;
  body: string;
  url: string;
}

/**
 * What `sendPush` is handed to say: one message for every device, or a
 * function of a device's locale (the language tag it registered with, empty
 * when it sent none) answering the message that device gets.
 */
export type PushMessageFor = PushMessage | ((locale: string) => PushMessage);

/** A registered device as the sender reads it. */
export interface PushDevice {
  id: string;
  platform: PushPlatform;
  token: string;
  locale: string;
}

/**
 * What `sendPush` did: how many devices the target has, how many FCM took,
 * how many it pruned because FCM no longer knows their token, and how many
 * failed otherwise. `dev` is the `[push:dev]` line it logged instead of
 * sending, when the environment names no FCM service account; empty otherwise.
 */
export interface PushOutcome {
  devices: number;
  sent: number;
  pruned: number;
  failed: number;
  dev: string;
}

/**
 * The environment `sendPush` reads: the service account's JSON key, and the
 * Firebase project to send through when it is not the account's own.
 */
export interface PushEnv {
  FCM_SERVICE_ACCOUNT_JSON?: string;
  FCM_PROJECT_ID?: string;
  [name: string]: unknown;
}

/** Where pushes stand on this device: `on` once it registered, `denied` when the person refused. */
export type PushState = "off" | "on" | "denied";

/** What `PUSH:PERMISSION` answers. */
export interface PushPermission {
  granted: boolean;
}

/** What `PUSH:TOKEN` answers: the FCM token of this install and the platform it runs on. */
export interface PushToken {
  token: string;
  platform: PushPlatform;
}

/** A failed push call: the message to show and the status (0 for a network failure). */
export interface PushError {
  ok?: false;
  error: string;
  status: number;
}

/** What `push.enable()` answers: the state it leaves, or why it could not. */
export type PushResult = { ok: true; status: PushState } | PushError;
