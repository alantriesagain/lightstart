/**
 * @file The dev server's port rules: the first free port from the flag, the project's
 * `light.dev.port`, then `PORT`, then 3000.
 */

/** The port a server starts from when nothing says otherwise. */
export const DEFAULT_PORT = 3000;

/** How many ports above the requested one are tried before the server gives up. */
export const MAX_PORT_ATTEMPTS = 100;

/** A port number, or null for anything that is not one. */
export const portOf = (value: unknown): number | null => {
  if (typeof value === "number") return Number.isInteger(value) && value >= 0 && value <= 65535 ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

/** The port to start from: the flag, then `light.dev.port`, then `PORT`, then the default. */
export const resolvePort = (options: { argsPort?: unknown; pkgPort?: unknown; env?: Record<string, string | undefined> } = {}): number => {
  const env = options.env ?? {};
  return portOf(options.argsPort) ?? portOf(options.pkgPort) ?? portOf(env["PORT"]) ?? DEFAULT_PORT;
};
