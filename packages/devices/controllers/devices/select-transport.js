/**
 * Transport selection: the one seam that keeps the native dependency contained.
 * Mirrors `packages/camera/select-backend.js`.
 */
import { mobile } from "@lightstart/mobile/page";
import { createNativeTransport } from "./transport-native.js";
import { createNullTransport } from "../../lib/transport-null.js";

/**
 * True when the surrounding shell declares the `devices` capability.
 */
export const hasNativeDevices = () => mobile.present && mobile.can("devices");

export const selectTransport = () => (hasNativeDevices() ? createNativeTransport() : createNullTransport());
