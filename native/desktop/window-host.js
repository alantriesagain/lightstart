/**
 * @bootstrapp/light/native/desktop/window-host: the script that gives a page its window. Installed
 * by DesktopWindow right after the `__desktop` binding, it defines `window.__desktopWindow`, the
 * object `env.window` answers in the page: the platform, whether the window draws its own title bar
 * (`frameless`) and whether the system's controls stay on it (`nativeControls`, macOS), the
 * window's state (maximized, fullscreen, focused, minimized, kept current by the window), and the
 * calls a title bar makes: minimize, toggle maximize, close, and drag. `dragFrom(event)` turns a
 * mousedown into a window move once the pointer travelled a few pixels with the button down, so
 * clicks and double-clicks stay in the page, and a double-click into maximize; the move is
 * anchored at the press, so the grabbed point stays under the pointer.
 */

/**
 * @param {string} platform "linux", "macos" or "windows"
 * @param {boolean} frameless
 */
export const windowHostScript = (platform, frameless) => "(() => {\n"
  + "  if (window.__desktopWindow) return;\n"
  + "  const platform = " + JSON.stringify(platform) + ";\n"
  + "  const frameless = " + (frameless ? "true" : "false") + ";\n"
  + "  const native = platform === \"macos\" && frameless;\n"
  + "  const listeners = new Set();\n"
  + "  const call = (op, x, y) => (typeof window.__desktop === \"function\" ? window.__desktop(\"$window\", x === undefined ? [op] : [op, x, y]) : Promise.resolve(null));\n"
  + "  const host = {\n"
  + "    platform, frameless, nativeControls: native, controlsInset: native ? 78 : 0,\n"
  + "    maximized: false, fullscreen: false, focused: true, minimized: false,\n"
  + "    minimize: () => { call(\"minimize\").then(() => {}, () => {}); },\n"
  + "    toggleMaximize: () => { call(\"maximize\").then(() => {}, () => {}); },\n"
  + "    close: () => { call(\"close\").then(() => {}, () => {}); },\n"
  + "    startDrag: (x, y) => { call(\"drag\", x, y).then(() => {}, () => {}); },\n"
  + "    dragFrom: (event) => {\n"
  + "      if (!frameless || event.button !== 0) return;\n"
  + "      if (event.detail === 2) { event.preventDefault(); host.toggleMaximize(); return; }\n"
  + "      if (event.detail > 2) return;\n"
  + "      event.preventDefault();\n"
  + "      const x = event.screenX;\n"
  + "      const y = event.screenY;\n"
  + "      const stop = () => {\n"
  + "        window.removeEventListener(\"mousemove\", move, true);\n"
  + "        window.removeEventListener(\"mouseup\", stop, true);\n"
  + "        window.removeEventListener(\"blur\", stop, true);\n"
  + "      };\n"
  + "      const move = (e) => {\n"
  + "        if ((e.buttons & 1) === 0) { stop(); return; }\n"
  + "        if (Math.abs(e.screenX - x) + Math.abs(e.screenY - y) < 4) return;\n"
  + "        stop();\n"
  + "        host.startDrag(x, y);\n"
  + "      };\n"
  + "      window.addEventListener(\"mousemove\", move, true);\n"
  + "      window.addEventListener(\"mouseup\", stop, true);\n"
  + "      window.addEventListener(\"blur\", stop, true);\n"
  + "    },\n"
  + "    subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },\n"
  + "  };\n"
  + "  const apply = (bits) => {\n"
  + "    if (typeof bits !== \"number\") return;\n"
  + "    const next = { maximized: (bits & 1) !== 0, fullscreen: (bits & 2) !== 0, focused: (bits & 4) !== 0, minimized: (bits & 8) !== 0 };\n"
  + "    let changed = false;\n"
  + "    for (const key of Object.keys(next)) if (host[key] !== next[key]) { host[key] = next[key]; changed = true; }\n"
  + "    if (changed) for (const fn of [...listeners]) fn(host);\n"
  + "  };\n"
  + "  Object.defineProperty(window, \"__desktopWindow\", { value: host, writable: false, configurable: false });\n"
  + "  window.__desktopWindowState = apply;\n"
  + "  call(\"state\").then(apply, () => {});\n"
  + "})();";
