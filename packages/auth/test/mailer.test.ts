// node-only
/**
 * @file The mailer `mailerFrom` picks and the Cloudflare Email Service mailer:
 * Resend first, then Cloudflare with `CF_EMAIL_TOKEN` preferred and
 * `AUTH_FROM_EMAIL` over `FROM_EMAIL`, else the console; and the exact
 * request a send makes, including Cloudflare's refusal and an error that
 * keeps the token out of it. `fetch` is stubbed, so nothing leaves the test.
 */

import { done, eq, eqn, ok } from "@lightstart/test/assert.ts";

import { cloudflareMailer, mailerFrom, type Mailer } from "../server/index.ts";

const realFetch = globalThis.fetch;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

interface Seen {
  url: string;
  init: RequestInit | null;
}

const withFetch = async (stub: typeof fetch, run: () => Promise<void>): Promise<void> => {
  globalThis.fetch = stub;
  try {
    await run();
  } finally {
    globalThis.fetch = realFetch;
  }
};

const sending = async (mailer: Mailer): Promise<Seen | null> => {
  const seen: Seen[] = [];
  await withFetch(
    ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      seen.push({ url, init: init ?? null });
      return Promise.resolve(jsonResponse({ success: true, id: "sent" }));
    }) as typeof fetch,
    async () => {
      await mailer.send({ to: "to@example.com", subject: "Your sign-in code", text: "123456" });
    },
  );
  return seen[0] ?? null;
};

const header = (init: RequestInit | null, name: string): string | null => new Headers(init?.headers).get(name);

const bodyOf = (init: RequestInit | null): unknown => {
  if (typeof init?.body !== "string") return null;
  return JSON.parse(init.body) as unknown;
};

const main = async (): Promise<void> => {
  {
    const mailer = mailerFrom(
      {
        RESEND_API_KEY: "resend-key",
        CF_ACCOUNT_ID: "account",
        CF_EMAIL_TOKEN: "email-token",
        AUTH_FROM_EMAIL: "auth@example.com",
        FROM_EMAIL: "from@example.com",
      },
      () => {},
    );
    const seen = await sending(mailer);
    eq("Resend wins when its key is set", seen?.url ?? "", "https://api.resend.com/emails");
    eq("with the Resend key", header(seen?.init ?? null, "authorization") ?? "", "Bearer resend-key");
    eq("and AUTH_FROM_EMAIL", String((bodyOf(seen?.init ?? null) as Record<string, unknown>)["from"]), "auth@example.com");
  }

  {
    const mailer = mailerFrom(
      {
        CF_ACCOUNT_ID: "account",
        CF_EMAIL_TOKEN: "email-token",
        CF_API_TOKEN: "api-token",
        AUTH_FROM_EMAIL: "auth@example.com",
        FROM_EMAIL: "from@example.com",
      },
      () => {},
    );
    const seen = await sending(mailer);
    eq(
      "Cloudflare follows when Resend is absent",
      seen?.url ?? "",
      "https://api.cloudflare.com/client/v4/accounts/account/email/sending/send",
    );
    eq("CF_EMAIL_TOKEN is preferred", header(seen?.init ?? null, "authorization") ?? "", "Bearer email-token");
    eq("AUTH_FROM_EMAIL wins over FROM_EMAIL", String((bodyOf(seen?.init ?? null) as Record<string, unknown>)["from"]), "auth@example.com");
  }

  {
    const mailer = mailerFrom(
      { CF_ACCOUNT_ID: "account", CF_API_TOKEN: "api-token", FROM_EMAIL: "from@example.com" },
      () => {},
    );
    const seen = await sending(mailer);
    eq("CF_API_TOKEN is used when there is no email token", header(seen?.init ?? null, "authorization") ?? "", "Bearer api-token");
    eq("FROM_EMAIL is used when there is no AUTH_FROM_EMAIL", String((bodyOf(seen?.init ?? null) as Record<string, unknown>)["from"]), "from@example.com");
  }

  {
    const lines: string[] = [];
    const mailer = mailerFrom({}, (line) => lines.push(line));
    eqn("the console is marked development", mailer.development === true ? 1 : 0, 1);
    const seen = await sending(mailer);
    eqn("it makes no request", seen === null ? 0 : 1, 0);
    eq("and logs the message", lines[0] ?? "", "123456");
  }

  {
    const mailer = cloudflareMailer({ accountId: "acct", apiToken: "secret-token", from: "from@example.com" });
    const seen = await sending(mailer);
    eq(
      "the Cloudflare URL names the account",
      seen?.url ?? "",
      "https://api.cloudflare.com/client/v4/accounts/acct/email/sending/send",
    );
    eq("a POST", String(seen?.init?.method), "POST");
    eq("the bearer token", header(seen?.init ?? null, "authorization") ?? "", "Bearer secret-token");
    eq("a JSON content type", header(seen?.init ?? null, "content-type") ?? "", "application/json");
    eq(
      "the exact body",
      JSON.stringify(bodyOf(seen?.init ?? null)),
      JSON.stringify({ to: "to@example.com", from: "from@example.com", subject: "Your sign-in code", text: "123456" }),
    );
  }

  {
    const mailer = cloudflareMailer({ accountId: "acct", apiToken: "secret-token", from: "from@example.com" });
    let message = "";
    await withFetch(
      () => Promise.resolve(jsonResponse({ success: false, errors: [{ code: 1, message: "sender is not verified" }] })),
      async () => {
        try {
          await mailer.send({ to: "to@example.com", subject: "s", text: "t" });
        } catch (error) {
          message = error instanceof Error ? error.message : String(error);
        }
      },
    );
    eq("a success false answer throws Cloudflare's message", message, "sender is not verified");
    ok("and never the token", !message.includes("secret-token"));
  }

  {
    const mailer = cloudflareMailer({ accountId: "acct", apiToken: "secret-token", from: "from@example.com" });
    let message = "";
    await withFetch(
      () => Promise.resolve(jsonResponse({}, 500)),
      async () => {
        try {
          await mailer.send({ to: "to@example.com", subject: "s", text: "t" });
        } catch (error) {
          message = error instanceof Error ? error.message : String(error);
        }
      },
    );
    eq("a non-ok answer without errors names the status", message, "email send failed (500)");
    ok("and never the token", !message.includes("secret-token"));
  }

  done();
};

await main();
