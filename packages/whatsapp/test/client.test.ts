// node-only
/**
 * @file The links a page draws, and an invite page read as a preview.
 */

import { readFileSync } from "node:fs";
import { done, eq } from "@lightstart/test/assert.ts";

import { isGroupPhoto, normalizeGroupInvite, waMeHref } from "../client.ts";
import { readInvite } from "../invite.ts";

const page = (name: string): string => readFileSync(new URL(`./fixtures/invites/${name}.html`, import.meta.url), "utf-8");

const main = async (): Promise<void> => {
  eq("waMeHref: a number as digits only", waMeHref("5521987654321"), "https://wa.me/5521987654321");
  eq("waMeHref: a number however it was written", waMeHref("+55 (21) 98765-4321"), "https://wa.me/5521987654321");
  eq("waMeHref: a username without @, lowercased", waMeHref("@Ana.Rio"), "https://wa.me/ana.rio");
  eq("waMeHref: a username with text", waMeHref("carla_m", "Oi"), "https://wa.me/carla_m?text=Oi");
  eq("waMeHref: the text is encoded", waMeHref("5521987654321", "Oi, tudo bem? & mais"), "https://wa.me/5521987654321?text=Oi%2C%20tudo%20bem%3F%20%26%20mais");
  eq("waMeHref: no recipient and a text opens the share picker", waMeHref("", "Oi, vem?"), "https://wa.me/?text=Oi%2C%20vem%3F");
  eq("waMeHref: nothing at all is empty", waMeHref("", ""), "");
  for (const bad of ["", "  ", "123", "+55 21", "1234567890123456", "ab", "@", "www.site", "a b", "ana@rio", "x".repeat(36), "javascript:alert(1)", "../x", "u/ana"])
    eq(`waMeHref: ${bad} is neither`, waMeHref(bad), "");

  eq("invite: https, with or without the scheme", normalizeGroupInvite("chat.whatsapp.com/AbCdEf1234"), "https://chat.whatsapp.com/AbCdEf1234");
  eq("invite: the query is dropped", normalizeGroupInvite("  http://chat.whatsapp.com/AbCdEf1234/?utm_source=x#y "), "https://chat.whatsapp.com/AbCdEf1234");
  for (const bad of ["", "https://chat.whatsapp.com/", "https://chat.whatsapp.com/short", `https://chat.whatsapp.com/${"a".repeat(41)}`, "https://evil.com/chat.whatsapp.com/AbCdEf1234", "https://chat.whatsapp.com.evil.com/AbCdEf1234", "https://chat.whatsapp.com/AbCd-Ef1234", "https://wa.me/5521987654321", "javascript:chat.whatsapp.com/AbCdEf1234"])
    eq(`invite: ${bad} is not one`, normalizeGroupInvite(bad), "");

  const group = readInvite(page("live"));
  eq("invite page: the group's name", group.name, "Rio Nomad Beach ☀️🏖");
  eq("invite page: a photo from WhatsApp's host", String(/^https:\/\/pps\.whatsapp\.net\/v\/.+&oe=6ACC09D8&/.test(group.image)), "true");
  eq("invite page: not dead", String(group.dead), "false");
  eq("invite page: a dead invite names no group", JSON.stringify(readInvite(page("dead"))), JSON.stringify({ name: "", image: "", dead: true }));
  eq("invite page: no page is dead", JSON.stringify(readInvite("")), JSON.stringify({ name: "", image: "", dead: true }));

  eq("photo: https on the photo host", String(isGroupPhoto("https://pps.whatsapp.net/v/t61/x.jpg?oe=1")), "true");
  eq("photo: http is refused", String(isGroupPhoto("http://pps.whatsapp.net/v/x.jpg")), "false");
  eq("photo: another host is refused", String(isGroupPhoto("https://static.whatsapp.net/rsrc.php/v4/yO/r/rukeqTVNJDY.png")), "false");
  eq("photo: a lookalike host is refused", String(isGroupPhoto("https://pps.whatsapp.net.evil.com/x.jpg")), "false");
  eq("photo: a script URL is refused", String(isGroupPhoto("javascript:alert(1)")), "false");

  done();
};

await main();
