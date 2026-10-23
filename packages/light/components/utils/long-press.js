/**
 * Long-press → contextmenu bridge for touch surfaces. Attach to a container;
 * a ~500ms single-finger hold synthesizes a bubbling `contextmenu`
 * MouseEvent on the pressed element, so existing `@contextmenu` bindings
 * work untouched on platforms that never fire the native event (iOS
 * Safari). A native `contextmenu` during the press (Android) cancels the
 * timer, so nothing double-fires. Returns a teardown for `this.$own()`.
 *
 * @param {HTMLElement} host
 * @param {{ delay?: number, moveTolerance?: number }} [opts]
 * @returns {() => void}
 */
export const attachLongPress = (host, { delay = 500, moveTolerance = 10 } = {}) => {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;
  let startX = 0;
  let startY = 0;
  /** @type {EventTarget | null} */
  let target = null;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    target = null;
  };

  const onTouchStart = (/** @type {TouchEvent} */ e) => {
    if (e.touches.length !== 1) return void cancel();
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    target = e.target;
    timer = setTimeout(() => {
      const pressed = target;
      cancel();
      pressed?.dispatchEvent(new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: startX,
        clientY: startY,
      }));
    }, delay);
  };

  const onTouchMove = (/** @type {TouchEvent} */ e) => {
    if (!timer) return;
    const touch = e.touches[0];
    if (Math.abs(touch.clientX - startX) > moveTolerance || Math.abs(touch.clientY - startY) > moveTolerance)
      cancel();
  };

  host.addEventListener("touchstart", onTouchStart, { passive: true });
  host.addEventListener("touchmove", onTouchMove, { passive: true });
  host.addEventListener("touchend", cancel);
  host.addEventListener("touchcancel", cancel);
  host.addEventListener("contextmenu", cancel, true);

  return () => {
    cancel();
    host.removeEventListener("touchstart", onTouchStart);
    host.removeEventListener("touchmove", onTouchMove);
    host.removeEventListener("touchend", cancel);
    host.removeEventListener("touchcancel", cancel);
    host.removeEventListener("contextmenu", cancel, true);
  };
};
