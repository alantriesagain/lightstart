/** Helpers the ported browser tests share: a poll and a collector for the errors the page raises. */

/**
 * Poll `ok` until it answers truthy, or fail after 2 s.
 * @param {() => boolean | Promise<boolean>} ok
 * @param {string} [message]
 */
export const until = async (ok, message = "the page did not reach the expected state") => {
  const deadline = Date.now() + 2000;
  for (;;) {
    if (await ok()) return;
    if (Date.now() > deadline) throw new Error(message);
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
};

/** Collect the errors the page raises until `stop()` (what the old boot's `app.errors` held). */
export const watchErrors = () => {
  /** @type {unknown[]} */
  const errors = [];
  /** @param {ErrorEvent} event */
  const onError = (event) => errors.push(event.error ?? event.message);
  /** @param {PromiseRejectionEvent} event */
  const onRejection = (event) => errors.push(event.reason);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return {
    errors,
    stop() {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    },
  };
};

/** Link the app's stylesheet into the test page, as the site's index.html does, and wait for it to apply. */
export const linkStyles = () =>
  new Promise((resolve, reject) => {
    if (document.querySelector("link[data-test-styles]") !== null) return resolve(undefined);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/src/styles.css";
    link.dataset.testStyles = "";
    link.onload = () => resolve(undefined);
    link.onerror = () => reject(new Error("the app's stylesheet did not load"));
    document.head.append(link);
  });
