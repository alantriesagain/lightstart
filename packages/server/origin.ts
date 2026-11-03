/**
 * @file An origin's authority, parsed by hand (scriptc has no global `URL`): `scheme://host[:port]`
 * with an http or https scheme, a bracketed IPv6 host allowed, nothing after the authority, no
 * userinfo, no percent-encoding in the host, a port of digits only. Answers `host[:port]` lower-cased,
 * or null for anything else. `Context.sameOrigin` and `safeRedirect` compare it with `c.host`.
 */
const digit = (code: number): boolean => code >= 48 && code <= 57;

const validPort = (port: string): boolean => {
  if (port === "") return false;
  for (let i = 0; i < port.length; i++) if (!digit(port.charCodeAt(i))) return false;
  return true;
};

/** `origin`'s `host[:port]`, lower-cased, or null when it is not a plain http(s) origin. */
export const authorityOf = (origin: string): string | null => {
  const split = origin.indexOf("://");
  if (split <= 0) return null;
  const scheme = origin.slice(0, split).toLowerCase();
  if (scheme !== "http" && scheme !== "https") return null;
  const rest = origin.slice(split + 3);
  if (rest === "") return null;
  if (rest.indexOf("/") >= 0 || rest.indexOf("?") >= 0 || rest.indexOf("#") >= 0 || rest.indexOf("@") >= 0) return null;
  let host = rest;
  let port = "";
  if (rest.startsWith("[")) {
    const end = rest.indexOf("]");
    if (end < 0) return null;
    host = rest.slice(0, end + 1);
    const after = rest.slice(end + 1);
    if (after !== "") {
      if (!after.startsWith(":")) return null;
      port = after.slice(1);
      if (port === "") return null;
    }
  } else {
    const colon = rest.lastIndexOf(":");
    if (colon >= 0) {
      host = rest.slice(0, colon);
      port = rest.slice(colon + 1);
      if (port === "") return null;
    }
    for (let i = 0; i < host.length; i++)
      if (host[i] === "%") return null;
  }
  if (host === "") return null;
  if (port !== "" && !validPort(port)) return null;
  const lower = host.toLowerCase();
  return port === "" ? lower : lower + ":" + port;
};
