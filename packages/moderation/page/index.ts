/**
 * @file The page half of `@lightstart/moderation`: the `$moderated` adapter
 * decorator and the pure photo helpers.
 */

export { configureModeration, moderated, registerModeration, submitToServer, viewerFromToken, type ModerationPageOptions } from "./moderation.ts";
export { dataUrlOf, ownPhotoOf, photoFor } from "./photo.ts";
export { pendingOf, provenanceOf } from "../index.ts";
