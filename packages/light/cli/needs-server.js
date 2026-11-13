/**
 * @file The optional peer `light test`, `light serve` and the desktop shell need. A project
 * without it gets one line, not a stack.
 */

/**
 * Whether `error` is the import of `@lightstart/server` failing.
 * @param {unknown} error
 */
export const needsServer = (error) =>
  error instanceof Error && /** @type {{ code?: unknown }} */ (error).code === "ERR_MODULE_NOT_FOUND" && error.message.includes("@lightstart/server");

/**
 * The line printed when a command needs the optional peer.
 * @param {string} command
 */
export const serverMessage = (command) =>
  `light ${command} needs @lightstart/server, an optional peer of @lightstart/light: npm i -D @lightstart/server`;
