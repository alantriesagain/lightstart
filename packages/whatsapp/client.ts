/**
 * @file The links a page draws: a chat with a person, by number or by username,
 * a group's invite, accepted only in the one shape WhatsApp hands out, and the
 * address WhatsApp serves a group's photo from.
 */

const NUMBER = /^\+?[\d\s().-]+$/;
const USERNAME = /^(?!www)(?=[a-z0-9._]*[a-z])[a-z0-9._]{3,35}$/;
const INVITE = /^(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9]{10,40})\/?(?:[?#].*)?$/i;

/** The host WhatsApp serves a group's photo from, as an invite page names it. */
export const GROUP_PHOTO_HOST = "pps.whatsapp.net";

/**
 * The `wa.me` link that opens a chat with `target`: a number in international
 * form (a leading `+`, spaces and dashes allowed) or a WhatsApp username (a
 * leading `@` allowed), with `text` typed in when given. With no target and a
 * text, the link opens WhatsApp's own picker with the text typed in, which is
 * how a message is shared to whoever the person chooses. Empty for anything
 * else.
 *
 * @param target a number, a username, or nothing
 * @param text what to type into the chat
 * @returns the `wa.me` link, or empty
 */
export const waMeHref = (target: string, text = ""): string => {
  const raw = String(target || "").trim();
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  if (!raw) return query ? `https://wa.me/${query}` : "";
  const digits = raw.replace(/\D/g, "");
  const name = raw.replace(/^@/, "").toLowerCase();
  const path = NUMBER.test(raw) ? (/^\d{8,15}$/.test(digits) ? digits : "") : USERNAME.test(name) ? name : "";
  if (!path) return "";
  return `https://wa.me/${path}${query}`;
};

/**
 * A group invite as `https://chat.whatsapp.com/<code>`, from what a person
 * pasted (with or without the scheme, any query dropped), or empty when it is
 * not one.
 *
 * @param raw what the person pasted
 * @returns the normalized invite, or empty
 */
export const normalizeGroupInvite = (raw: string): string => {
  const match = INVITE.exec(String(raw || "").trim());
  return match?.[1] !== undefined ? `https://chat.whatsapp.com/${match[1]}` : "";
};

/**
 * Whether a URL is a group photo as an invite page names it: https, on
 * WhatsApp's photo host. The address carries its own expiry (`oe`), so it draws
 * for days, not for good.
 *
 * @param raw the photo address
 * @returns whether it is one WhatsApp serves
 */
export const isGroupPhoto = (raw: string): boolean => {
  try {
    const url = new URL(String(raw || ""));
    return url.protocol === "https:" && url.hostname === GROUP_PHOTO_HOST;
  } catch {
    return false;
  }
};
