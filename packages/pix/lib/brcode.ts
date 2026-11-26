/**
 * @file The BR Code of a Pix: the text a bank app scans from a QR or takes
 * pasted under Pix Copia e Cola. An EMV "merchant presented" payload, each
 * field its id, its length in two digits and its value, closed by a CRC16 of
 * everything before it. Pure, the same in a browser and under node.
 */

import type { PixCode } from "../types.ts";

/**
 * CRC16-CCITT (polynomial 0x1021, starting at 0xFFFF), as four uppercase hex digits.
 *
 * @param text The payload to close.
 * @returns The checksum as four hexadecimal digits.
 */
export const crc16 = (text: string): string => {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
};

/**
 * Text as a merchant field takes it: accents folded, only letters, digits and
 * spaces kept, at most `max` characters.
 *
 * @param text The text to fold.
 * @param max The most characters the field holds.
 * @returns The folded text.
 */
export const pixText = (text: string, max: number): string =>
  String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, max)
    .trim();

const field = (id: string, value: string): string => `${id}${String(value.length).padStart(2, "0")}${value}`;

/**
 * The BR Code for a payment of `amount` (in centavos, left out for any amount)
 * to `key`, under the reference `txid` (up to 25 letters and digits; `***` when
 * there is none).
 *
 * @param code The account, the amount and the reference.
 * @returns The EMV payload closed by its CRC16.
 */
export const brcode = ({ key, name, city, amount = 0, txid = "" }: PixCode): string => {
  const reference = String(txid).replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const payload = [
    field("00", "01"),
    field("26", field("00", "br.gov.bcb.pix") + field("01", String(key).trim())),
    field("52", "0000"),
    field("53", "986"),
    amount > 0 ? field("54", (amount / 100).toFixed(2)) : "",
    field("58", "BR"),
    field("59", pixText(name, 25)),
    field("60", pixText(city, 15)),
    field("62", field("05", reference)),
    "6304",
  ].join("");
  return payload + crc16(payload);
};
