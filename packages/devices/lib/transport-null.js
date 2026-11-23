/**
 * The transport used everywhere that is not a native shell: the dev server,
 * a desktop browser, a prerender pass. Every call rejects with a stable code so
 * a view can render "open the phone app" instead of throwing.
 */

const unavailable = () => Promise.reject(new Error("no-transport"));

export const createNullTransport = () => ({
  available: () => false,
  ble: {
    scan: async () => [],
    stopScan: async () => {},
    connect: unavailable,
    disconnect: async () => {},
    subscribe: unavailable,
    write: unavailable,
    read: unavailable,
    onNotify: () => () => {},
    onState: () => () => {},
  },
  wifi: {
    join: unavailable,
    leave: async () => {},
  },
  preview: {
    start: unavailable,
    stop: async () => {},
    bounds: async () => {},
    snapshot: unavailable,
    onState: () => () => {},
  },
  net: {
    getJson: unavailable,
    fetchToFile: unavailable,
  },
});
