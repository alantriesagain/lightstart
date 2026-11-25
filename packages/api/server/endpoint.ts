/**
 * @file `defineEndpoint` declares one route an app's server answers beside its
 * model CRUD: a path (in `@lightstart/server`'s pattern syntax), a method, who
 * may call it, and a handler. The handler reads the request, its path
 * parameters, its query, its JSON body, the resolved caller and the
 * `D1Like` database, and answers a `Response`, a string (`text/plain`) or any
 * other value as JSON.
 */

import { HttpError } from "@lightstart/server";

import type { Caller } from "./permissions.ts";
import type { D1Like } from "./d1.ts";

/** Who may call an endpoint: anyone, any caller, or an admin. */
export type EndpointAccess = "public" | "auth" | "admin";

/** The HTTP methods an endpoint declares. */
export type EndpointMethod = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

/** What an endpoint's handler is handed. */
export interface EndpointRequest {
  /** The request as a Fetch `Request`. */
  request: Request;
  /** The values of the path's parameters, by name. */
  params: Record<string, string>;
  /** The query string as a plain record, the last value of a repeated name winning. */
  query: Record<string, string>;
  /** The JSON body of a non-GET request with a JSON content type, else null. */
  body: unknown;
  /** Who makes the request, as the caller function resolved it. */
  caller: Caller;
  /** The database a handler reads and writes, awaited through `D1Like`. */
  db: D1Like;
  /** The environment the server was given. */
  env: Record<string, unknown>;
}

/** What an endpoint's handler answers: a `Response` passed through, a string as text, anything else as JSON. */
export type EndpointHandler = (request: EndpointRequest) => unknown | Promise<unknown>;

/** What `defineEndpoint` is given. */
export interface EndpointDefinition {
  /** The route pattern, e.g. `/api/meetups/:id/accept`. */
  path: string;
  /** The method it answers, `GET` by default. */
  method?: EndpointMethod;
  /** Who may call it, `auth` by default. */
  access?: EndpointAccess;
  /** What it answers. */
  handler: EndpointHandler;
}

/** A declared endpoint, with its defaults filled in. */
export interface Endpoint {
  readonly path: string;
  readonly method: EndpointMethod;
  readonly access: EndpointAccess;
  readonly handler: EndpointHandler;
}

/** Declare an endpoint: its path, method (`GET`), access (`auth`) and handler. */
export const defineEndpoint = (definition: EndpointDefinition): Endpoint => ({
  path: definition.path,
  method: definition.method === undefined ? "GET" : (definition.method.toUpperCase() as EndpointMethod),
  access: definition.access ?? "auth",
  handler: definition.handler,
});

/** The JSON body of a non-GET request with a JSON content type, else null. */
export const bodyOfRequest = async (request: Request, method: string): Promise<unknown> => {
  if (method === "GET" || method === "HEAD") return null;
  const type = request.headers.get("content-type");
  if (type === null) return null;
  const mime = type.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mime !== "application/json" && !mime.endsWith("+json")) return null;
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "invalid JSON body");
  }
};

/** The names of a pattern's parameters, in order. */
export const parameterNames = (pattern: string): string[] => {
  const names: string[] = [];
  for (const segment of pattern.slice(1).split("/")) {
    if (segment.startsWith(":") && segment.length > 1) names.push(segment.slice(1));
  }
  return names;
};
