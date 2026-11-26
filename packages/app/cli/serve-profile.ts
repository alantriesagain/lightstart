/**
 * @file The profile `light serve --profile` chose, held for the serve hooks: a hook
 * runs with its payload, not the extension's arguments, so the serve extension
 * stores the name here where both hooks can read it.
 */

let chosen: string | undefined = undefined;

/** Remember the profile the serve extension was given, `undefined` for none. */
export const setServeProfile = (profile: string | undefined): void => {
  chosen = profile;
};

/** The profile `light serve --profile` chose, `undefined` when it named none. */
export const serveProfile = (): string | undefined => chosen;
