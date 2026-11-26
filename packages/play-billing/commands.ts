/**
 * @file The command names `<play-checkout>` speaks over the mobile bridge to
 * the Android shell's Play Billing add-on: the products this device sells,
 * and the purchase sheet.
 */

/** Ask the shell for the plans' Play products, as Play states them on this device. */
export const PLAY_PRODUCTS = "PLAY:PRODUCTS";

/** Ask the shell to open Play's purchase sheet for one product. */
export const PLAY_BUY = "PLAY:BUY";
