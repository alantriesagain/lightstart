/**
 * The model layer's cross-runtime commands: what the frontend registry sends
 * the db-worker (`$APP.worker.request(MODEL_QUERY, { model, opts })`) and
 * what `bootstrapp/model/backend` answers. Import-only, like every commands.js.
 */

export const MODEL_GET = "MODEL:GET";
export const MODEL_QUERY = "MODEL:QUERY";
export const MODEL_COUNT = "MODEL:COUNT";
export const MODEL_EXISTS = "MODEL:EXISTS";
export const MODEL_FACETS = "MODEL:FACETS";
export const MODEL_ADD = "MODEL:ADD";
export const MODEL_ADD_MANY = "MODEL:ADD_MANY";
export const MODEL_EDIT = "MODEL:EDIT";
export const MODEL_REMOVE = "MODEL:REMOVE";
export const MODEL_REMOVE_MANY = "MODEL:REMOVE_MANY";
