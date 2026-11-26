/**
 * @file Telling a crawler from a person by what it says it is and what it asked
 * for.
 *
 * Both signals are advisory. A user agent is self-reported and a path only says
 * what was probed, so `reason` carries which one fired and a caller that cares
 * can weigh them.
 */

import type { BotVerdict } from "./types.ts";

const BOT_UA = [
  /bot/i, /crawler/i, /spider/i, /scraper/i,
  /curl/i, /wget/i, /python/i, /java\//i, /go-http/i,
  /googlebot/i, /bingbot/i, /slurp/i, /duckduckbot/i,
  /baiduspider/i, /yandexbot/i, /facebookexternalhit/i,
  /twitterbot/i, /linkedinbot/i, /whatsapp/i,
  /applebot/i, /ahrefsbot/i, /semrushbot/i, /mj12bot/i,
  /dotbot/i, /petalbot/i, /bytespider/i,
];

const BOT_PATH = [
  /^\/wp-admin/i, /^\/wp-login\.php/i, /^\/wp-includes/i, /^\/wp-content/i,
  /^\/wordpress/i, /^\/xmlrpc\.php/i,
  /^\/\.env/i, /^\/\.git/i, /^\/\.htaccess/i, /^\/config\.(php|yml|json)/i, /^\/\.aws/i,
  /\.php$/i, /^\/phpmyadmin/i, /^\/phpinfo/i,
  /^\/cgi-bin/i, /^\/administrator/i, /^\/manager/i,
  /^\/shell/i, /^\/backup/i,
];

/**
 * Whether a user agent names a crawler, a command-line client or a scanner.
 *
 * @param userAgent the request's self-reported user agent
 * @returns whether the user-agent list matched
 */
export const isBotUserAgent = (userAgent: string): boolean => !!userAgent && BOT_UA.some((pattern) => pattern.test(userAgent));

/**
 * Whether a path is one only a scanner probes, such as a WordPress login or a
 * dotfile.
 *
 * @param path the request's path
 * @returns whether the path list matched
 */
export const isSuspiciousPath = (path: string): boolean => !!path && BOT_PATH.some((pattern) => pattern.test(path));

/**
 * Whether a request looks like a crawler, and which signal said so. `reason` is
 * `"both"` when the user agent and the path agree, one name when only that
 * signal fired, and null when neither did.
 *
 * @param userAgent the request's self-reported user agent
 * @param path the request's path
 * @returns the verdict and the signal behind it
 */
export const detectBot = (userAgent: string, path: string): BotVerdict => {
  const ua = isBotUserAgent(userAgent);
  const suspicious = isSuspiciousPath(path);
  if (ua && suspicious) return { isBot: true, reason: "both" };
  if (ua) return { isBot: true, reason: "user_agent" };
  if (suspicious) return { isBot: true, reason: "path" };
  return { isBot: false, reason: null };
};
