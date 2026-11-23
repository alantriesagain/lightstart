/**
 * Driver registry. Module-scope so a driver package can register at its own
 * module-eval time, before the devices controller exists: registration order
 * and controller creation order are then independent.
 *
 * @import { DeviceDriver } from "../types.ts"
 */

/** @type {Map<string, DeviceDriver>} */
const drivers = new Map();

/** @param {DeviceDriver} driver */
export const registerDriver = (driver) => {
  if (!driver?.id) throw new Error("a device driver needs an id");
  drivers.set(driver.id, driver);
  return driver;
};

/** @returns {DeviceDriver[]} */
export const getDrivers = () => [...drivers.values()];

/** @param {string} id */
export const driverById = (id) => drivers.get(id) ?? null;

/**
 * First driver claiming an advertisement, or null.
 * @param {{ id: string, name?: string, services?: string[] }} advertisement
 */
export const driverFor = (advertisement) =>
  getDrivers().find((driver) => {
    try {
      return driver.matches?.(advertisement) ?? false;
    } catch {
      return false;
    }
  }) ?? null;

/** Every service UUID any registered driver wants to scan for. */
export const scanServices = () => [
  ...new Set(getDrivers().flatMap((driver) => driver.scanFilter?.services ?? [])),
];
