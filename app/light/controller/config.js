/**
 * @lightstart/light/controller: what controllers read from their host
 * `track(label)` is called when async work starts (a controller connecting, a
 * resource fetching) and answers what ends it, so a host that waits for a
 * quiet page counts it; `ready()` answers what a resource waits for before its
 * first fetch; `events` is the bus a resource's `invalidateOn` listens on. A
 * page with no host keeps the defaults: nothing tracked, no gate, no bus.
 */

                                                   

/** The host's hooks, as `configureControllers` left them. */
export const config                   = {
  track: () => undefined,
  ready: () => undefined,
  events: null,
};

/**
 * Hand the controllers what their host knows. An option left out keeps its
 * current value.
 */
export const configureControllers = (options                           ) => {
  if (options.track !== undefined) config.track = options.track;
  if (options.ready !== undefined) config.ready = options.ready;
  if (options.events !== undefined) config.events = options.events;
};

/** Count `work` with the host until it settles, under `label`; answers `work`. */
export const tracked =    (work            , label        )             => {
  const done = config.track(label);
  if (done) work.then(done, done);
  return work;
};
