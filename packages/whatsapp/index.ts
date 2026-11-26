/**
 * @file @lightstart/whatsapp: an account connected to WhatsApp by a code the
 * person sends from their own WhatsApp, and signing in with it. The entry
 * carries what a page uses; the server half lives under `server/`, the page's
 * controller under `page/`.
 */

export { GROUP_PHOTO_HOST, isGroupPhoto, normalizeGroupInvite, waMeHref } from "./client.ts";
export { readInvite } from "./invite.ts";
export type { GroupInvite } from "./server/types.ts";
