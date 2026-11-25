/**
 * @file How a sign-in code reaches the address that asked for it: Resend in
 * production, and a log line in development. Both are the small `Mailer`
 * shape the auth routes call.
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

/** A mailer that writes each message's text through `log`, for development. */
export const consoleMailer = (log: (line: string) => void): Mailer => ({
  send(message: MailMessage): void {
    log(message.text);
  },
});

/** Resend when `env.RESEND_API_KEY` is set, otherwise the console. */
export const mailerFrom = (env: Record<string, unknown>, log: (line: string) => void): Mailer => {
  const apiKey = env["RESEND_API_KEY"];
  if (typeof apiKey === "string" && apiKey !== "") {
    const from = env["AUTH_FROM_EMAIL"];
    return resendMailer({ apiKey, from: typeof from === "string" && from !== "" ? from : "onboarding@resend.dev" });
  }
  return consoleMailer(log);
};
