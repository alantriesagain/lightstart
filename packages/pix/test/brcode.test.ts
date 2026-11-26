/**
 * @file The BR Code carries the Banco Central's static example to its
 * checksum, its amount and reference, and folds the merchant fields the way a
 * bank app reads them.
 */

import { done, eq, ok } from "@lightstart/test/assert.ts";

import { brcode, crc16, pixText } from "../lib/brcode.ts";

const EXAMPLE = "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";

eq(
  "builds the static example from the Banco Central's BR Code manual, to the checksum",
  brcode({ key: "123e4567-e12b-12d1-a456-426655440000", name: "Fulano de Tal", city: "BRASILIA" }),
  EXAMPLE,
);
eq("checks with the CRC16 the manual's example carries", crc16(EXAMPLE.slice(0, -4)), "1D3D");

const paid = brcode({ key: "pix@meetup.rio", name: "MEETUP RIO", city: "RIO DE JANEIRO", amount: 4900, txid: "ABCDEFGHJKLMNPQRSTUV" });
ok("carries the amount in reais with two decimals", /540549\.00/.test(paid));
ok("carries the reference", /62240520ABCDEFGHJKLMNPQRSTUV6304[0-9A-F]{4}$/.test(paid));
eq("closes the amount and reference with its own CRC16", crc16(paid.slice(0, -4)), paid.slice(-4));

eq("folds accents and drops what a field cannot carry", pixText("São Conrado · Pedra Bonita!", 25), "Sao Conrado Pedra Bonita");
eq("keeps a city to its length", pixText("RIO DE JANEIRO DA SILVA", 15), "RIO DE JANEIRO");
const folded = brcode({ key: "k", name: "Açaí do Leblon & Filhos Comércio Ltda", city: "Niterói", amount: 2900, txid: "a-b_c" });
ok("writes the folded merchant name", /5925Acai do Leblon Filhos Co/.test(folded));
ok("writes the folded city", /6007Niteroi/.test(folded));
ok("writes the reference with only letters and digits", /62070503abc/.test(folded));

done();
