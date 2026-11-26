// node-only
/**
 * @file What a Meta delivery means: the texts, the shared numbers, the moves,
 * and everything the package drops.
 */

import { readFileSync } from "node:fs";
import { done, eq, eqn } from "@lightstart/test/assert.ts";

import { eventsOf } from "../server/parse.ts";

const PHONE_NUMBER_ID = "106540352242922";

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/webhooks/${name}.json`, import.meta.url), "utf-8")) as unknown;

const parse = (name: string, options: { phoneNumberId?: string } = { phoneNumberId: PHONE_NUMBER_ID }): ReturnType<typeof eventsOf> => eventsOf(fixture(name), options);

const main = async (): Promise<void> => {
  eq(
    "parse: a text from somebody WhatsApp names only by number",
    JSON.stringify(parse("text")),
    JSON.stringify([
      {
        kind: "text",
        id: "wamid.HBgLMTY1MDU1NTEyMzQVAgASGBQzQTdBNjlGMUUzRDRBN0E2QTA0OAA=",
        sender: { bsuid: "", waId: "16505551234", username: "", country: "" },
        text: "My code is 482913, thanks",
      },
    ]),
  );

  const [bsuid] = parse("text-bsuid");
  eq("parse: the business-scoped id, number, username and country", JSON.stringify(bsuid?.kind === "text" ? bsuid.sender : null), JSON.stringify({ bsuid: "BR.13491208655302741918", waId: "5521987654321", username: "bruno.rio", country: "BR" }));
  eq("parse: the text it carried", bsuid?.kind === "text" ? bsuid.text : "", "code 731205");

  const [username] = parse("text-username");
  eq("parse: a username whose number is withheld", JSON.stringify(username?.kind === "text" ? username.sender : null), JSON.stringify({ bsuid: "AR.88231907716254409312", waId: "", username: "carla_m", country: "AR" }));

  eq(
    "parse: a number shared when asked is a contact event",
    JSON.stringify(parse("contact-request")),
    JSON.stringify([
      {
        kind: "contact",
        id: "wamid.HBgVQVIuODgyMzE5MDc3MTYyNTQ0MDkzMTIVAgASGBQzQUQxRTJGM0E0QjVDNkQ3RTg5RgA=",
        sender: { bsuid: "AR.88231907716254409312", waId: "", username: "carla_m", country: "AR" },
        waId: "5491123456789",
      },
    ]),
  );

  const payload = fixture("contact-request") as Record<string, unknown>;
  const entry = (payload["entry"] as unknown[])[0] as Record<string, unknown>;
  const change = (entry["changes"] as unknown[])[0] as Record<string, unknown>;
  const value = change["value"] as Record<string, unknown>;
  const message = (value["messages"] as unknown[])[0] as Record<string, unknown>;
  const shared = (message["contacts"] as unknown[])[0] as Record<string, unknown>;
  shared["origin"] = "other";
  eqn("parse: a contact card shared another way is dropped", eventsOf(payload, { phoneNumberId: PHONE_NUMBER_ID }).length, 0);

  eq(
    "parse: a user_id_update moves the person to the new id",
    JSON.stringify(parse("user-id-update")),
    JSON.stringify([
      {
        kind: "renumber",
        id: "",
        sender: { bsuid: "BR.13491208655302741918", waId: "5521912345678", username: "", country: "BR" },
        bsuid: "BR.40920175531848862207",
        waId: "5521912345678",
      },
    ]),
  );

  const renumber = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: PHONE_NUMBER_ID },
              contacts: [{ profile: { name: "Ana" }, wa_id: "16505551234" }],
              messages: [
                {
                  from: "16505551234",
                  id: "wamid.sys",
                  type: "system",
                  system: { body: "Ana changed from 16505551234 to 16505559999", new_wa_id: "16505559999", type: "user_changed_number" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
  eq(
    "parse: a changed number moves the person to it",
    JSON.stringify(eventsOf(renumber, { phoneNumberId: PHONE_NUMBER_ID })),
    JSON.stringify([
      {
        kind: "renumber",
        id: "wamid.sys",
        sender: { bsuid: "", waId: "16505551234", username: "", country: "" },
        bsuid: "",
        waId: "16505559999",
      },
    ]),
  );

  eqn("parse: delivery receipts are dropped", parse("statuses").length, 0);
  eqn("parse: images and their captions are dropped", parse("image").length, 0);
  eqn("parse: another business number is dropped", parse("text-bsuid", { phoneNumberId: "999" }).length, 0);
  eqn("parse: with no number configured nothing is dropped for one", parse("text-bsuid", {}).length, 1);

  for (const junk of [null, {}, [], "x", { entry: "x" }, { entry: [{ changes: [{ value: { messages: [{ type: "text" }] } }] }] }])
    eqn("parse: a body that is not a delivery reads nothing", eventsOf(junk).length, 0);

  done();
};

await main();
