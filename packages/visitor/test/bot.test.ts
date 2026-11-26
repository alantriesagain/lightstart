/**
 * @file Bot detection: the user-agent and path lists, and the reason that says
 * which signal fired.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";
import { detectBot, isBotUserAgent, isSuspiciousPath } from "../server/bot.ts";

const verdict = (userAgent: string, path: string): string => JSON.stringify(detectBot(userAgent, path));

const main = async (): Promise<void> => {
  ok("isBotUserAgent: a crawler", isBotUserAgent("Googlebot/2.1"));
  ok("isBotUserAgent: a command-line client", isBotUserAgent("curl/8.4.0"));
  ok("isBotUserAgent: a scripted client", isBotUserAgent("python-requests/2.31"));
  ok("isBotUserAgent: a browser is not one", !isBotUserAgent("Mozilla/5.0 (X11; Linux x86_64) Firefox/128.0"));
  ok("isBotUserAgent: an empty agent is not one", !isBotUserAgent(""));

  ok("isSuspiciousPath: a WordPress login", isSuspiciousPath("/wp-login.php"));
  ok("isSuspiciousPath: a dotfile", isSuspiciousPath("/.env"));
  ok("isSuspiciousPath: a shell", isSuspiciousPath("/shell"));
  ok("isSuspiciousPath: a backup", isSuspiciousPath("/backup"));
  ok("isSuspiciousPath: an ordinary page is not one", !isSuspiciousPath("/about"));
  ok("isSuspiciousPath: an empty path is not one", !isSuspiciousPath(""));

  eq("detectBot: both signals", verdict("Googlebot/2.1", "/wp-admin"), JSON.stringify({ isBot: true, reason: "both" }));
  eq("detectBot: the user agent alone", verdict("Googlebot/2.1", "/about"), JSON.stringify({ isBot: true, reason: "user_agent" }));
  eq("detectBot: the path alone", verdict("Mozilla/5.0 Firefox/128.0", "/.git/config"), JSON.stringify({ isBot: true, reason: "path" }));
  eq("detectBot: neither", verdict("Mozilla/5.0 Firefox/128.0", "/about"), JSON.stringify({ isBot: false, reason: null }));

  done();
};

await main();
