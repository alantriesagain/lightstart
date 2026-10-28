/**
 * @file The error a handler, a middleware or a body reader throws to answer with a status:
 * `throw new HttpError(404, "no such cart")`. The app's error handler turns it into
 * `{ "error": message }` with that status; any other thrown value is a 500 whose message is
 * logged and never sent.
 */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}
