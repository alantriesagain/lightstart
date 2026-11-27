/**
 * @file How a sign-in code reaches the address that asked for it: Resend or
 * Cloudflare Email Service in production, and a log line in development. Each
 * is the small `Mailer` shape the auth routes call.
 */

/** One message the auth routes send. */
export interface MailMessage {
  /** The address the code goes to. */
  to: string;
  /** The line a mail client shows. */
  subject: string;
  /** The message itself, the code included. */
  text: string;
}

/** What `authEndpoints` sends its code through. */
export interface Mailer {
  /** Send one message; the answer is not read. */
  send(message: MailMessage): unknown | Promise<unknown>;
  /** A mailer that only logs, for development: on Cloudflare the code route refuses it rather than answer a code nobody receives. */
  development?: boolean;
}

/** How `resendMailer` is built. */
export interface ResendOptions {
  /** The Resend API key. */
  apiKey: string;
  /** The verified sender Resend shows. */
  from: string;
}

/**
 * A mailer over Resend's HTTP API. A refused send throws, so the route
 * answers 500 rather than pretending a code went out.
 */
export const resendMailer = (options: ResendOptions): Mailer => ({
  async send(message: MailMessage): Promise<void> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: options.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!response.ok) throw new Error(`resend answered ${response.status}`);
  },
});

/** How `cloudflareMailer` is built. */
export interface CloudflareOptions {
  /** The Cloudflare account the Email Service sends from. */
  accountId: string;
  /** A token scoped to sending email, or an account API token. */
  apiToken: string;
  /** The verified sender Cloudflare shows. */
  from: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * A mailer over Cloudflare Email Service's REST API, with no binding. A send
 * fails when the response is not ok or its body says `success: false`; the
 * error is Cloudflare's `errors[0].message`, else `email send failed (<status>)`.
 */
export const cloudflareMailer = (options: CloudflareOptions): Mailer => ({
  async send(message: MailMessage): Promise<void> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${options.accountId}/email/sending/send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: message.to,
          from: options.from,
          subject: message.subject,
          text: message.text,
        }),
      },
    );
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    const success = isRecord(body) ? body["success"] : undefined;
    if (response.ok && success !== false) return;
    let detail: string | null = null;
    if (isRecord(body) && Array.isArray(body["errors"])) {
      const first: unknown = body["errors"][0];
      if (isRecord(first) && typeof first["message"] === "string") detail = first["message"];
    }
    throw new Error(detail ?? `email send failed (${response.status})`);
  },
});

/** A mailer that writes each message's text through `log`, for development. */
export const consoleMailer = (log: (line: string) => void): Mailer => ({
  development: true,
  send(message: MailMessage): void {
    log(message.text);
  },
});

const nonEmpty = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

/**
 * Resend when `env.RESEND_API_KEY` is set; else Cloudflare Email Service when
 * `env.CF_ACCOUNT_ID`, `env.CF_EMAIL_TOKEN` (preferred) or `env.CF_API_TOKEN`,
 * and a from address (`env.AUTH_FROM_EMAIL`, else `env.FROM_EMAIL`) are set;
 * else the console, which a deployed Worker refuses.
 */
export const mailerFrom = (env: Record<string, unknown>, log: (line: string) => void): Mailer => {
  const apiKey = nonEmpty(env["RESEND_API_KEY"]);
  if (apiKey !== null) {
    return resendMailer({ apiKey, from: nonEmpty(env["AUTH_FROM_EMAIL"]) ?? "onboarding@resend.dev" });
  }
  const accountId = nonEmpty(env["CF_ACCOUNT_ID"]);
  const token = nonEmpty(env["CF_EMAIL_TOKEN"]) ?? nonEmpty(env["CF_API_TOKEN"]);
  const from = nonEmpty(env["AUTH_FROM_EMAIL"]) ?? nonEmpty(env["FROM_EMAIL"]);
  if (accountId !== null && token !== null && from !== null) {
    return cloudflareMailer({ accountId, apiToken: token, from });
  }
  return consoleMailer(log);
};
