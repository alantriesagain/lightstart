/**
 * @file The fixture's `hello` mode: a line and the code it exits with.
 */

/** Print a line and answer the exit code. */
export const main = async (_argv: readonly string[]): Promise<number> => {
  console.log("mode hello");
  return 3;
};
