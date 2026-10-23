/**
 * @bootstrapp/light/native/desktop/init: the script the shell installs into every page load
 * before the page's own scripts run. It gives the page the event side of the bridge: a listener
 * table and a queue for events that arrive before a listener does, so a reload keeps working and
 * nothing emitted early is lost. The call side, `window.__desktop`, is the webview's own binding.
 */

export const initScript = `(() => {
  if (window.__desktopEmit) return;
  const listeners = new Map();
  const queued = [];
  window.__desktopListen = (name, fn) => {
    let set = listeners.get(name);
    if (!set) {
      set = new Set();
      listeners.set(name, set);
    }
    set.add(fn);
    const kept = [];
    for (const entry of queued) if (entry[0] === name) fn(entry[1]); else kept.push(entry);
    queued.length = 0;
    for (const entry of kept) queued.push(entry);
  };
  window.__desktopUnlisten = (name, fn) => {
    const set = listeners.get(name);
    if (set) set.delete(fn);
  };
  window.__desktopEmit = (name, value) => {
    const set = listeners.get(name);
    if (!set || set.size === 0) {
      if (queued.length < 256) queued.push([name, value]);
      return;
    }
    for (const fn of [...set]) fn(value);
  };
})();`;
