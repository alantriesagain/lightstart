/**
 * @file Which photo to draw for a person. Everybody is drawn from the
 * account's `avatarUrl`, except the person who sent a photo from this device,
 * who is drawn from the newest one they sent: while it waits for review, after
 * a refusal they are never told about, and after it is published.
 */

import { base64Of } from "../index.ts";

import type { OwnPhoto, PendingPhoto } from "../types.ts";

/**
 * Your photo as this device holds it: the newest photo you sent from here, or
 * null when you sent none.
 */
export const ownPhotoOf = (photos: PendingPhoto[]): OwnPhoto | null => {
  const newest = photos.reduce<PendingPhoto | null>((best, photo) => (best === null || photo.created > best.created ? photo : best), null);
  return newest !== null && typeof newest.image === "string" && newest.image !== "" ? { id: newest.id, status: "pending", image: newest.image, url: "" } : null;
};

/**
 * The address to draw a person's photo from, or "" for none.
 */
export const photoFor = (person: { avatarUrl?: unknown } | null | undefined, own?: OwnPhoto | null): string => {
  if (own !== null && own !== undefined && (own.status === "pending" || own.status === "rejected") && own.image !== "") return own.image;
  if (own?.status === "published" && own.url !== "") return own.url;
  return typeof person?.avatarUrl === "string" ? person.avatarUrl : "";
};

/**
 * A blob as a data URL, the shape a photo is sent in.
 */
export const dataUrlOf = async (blob: Blob): Promise<string> => `data:${blob.type || "application/octet-stream"};base64,${base64Of(new Uint8Array(await blob.arrayBuffer()))}`;
