/**
 * @bootstrapp/router: Signal Plugin
 * Adds reactive signal support to router using @bootstrapp/controller.
 */

import { signal } from "/app/light/signals/index.js";

/** @import { RouterPlugin } from "../types.js" */

/**
 * @returns {RouterPlugin}
 */
export function signalPlugin() {
  return (router) => {
    const currentRouteSignal = signal(router.currentRoute);
    const stackSignal = signal(router.stack);

    const originalUpdateCurrentRoute = router.updateCurrentRoute.bind(router);
    router.updateCurrentRoute = (route) => {
      originalUpdateCurrentRoute(route);
      currentRouteSignal.value = router.currentRoute;
      stackSignal.value = router.stack;
    };

    return {
      currentRouteSignal,
      stackSignal,
    };
  };
}

export default signalPlugin;
