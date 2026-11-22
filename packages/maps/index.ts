/**
 * @file @lightstart/maps: a slippy map over self-hosted raster tiles, with
 * drop pins, clustering and keyless geocoding. Providers answer a place
 * search, and the links a maps app shares are read by `links.js`.
 */

import type { MapsProvider, NominatimResult } from "./types.ts";

export { findMapsLink, parseMapsLink, readPreview } from "./links.js";

const providers: Record<string, MapsProvider> = {
  nominatim: {
    search: async (query: string) => {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=10&addressdetails=1`,
        {
          headers: {
            "User-Agent": "lightstart-maps/1.0",
          },
        },
      );
      const data = (await res.json()) as NominatimResult[];
      return data.map((item) => ({
        id: item.place_id,
        name: item.name || item.display_name.split(",")[0],
        address: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type,
        category: item.class,
      }));
    },
  },
};

export const createMapsClient = (provider = "nominatim") => {
  const impl = providers[provider];
  if (!impl) throw new Error(`Unknown maps provider: ${provider}`);

  return {
    search: (query: string) => impl.search(query),
    provider,
  };
};

export const registerProvider = (name: string, impl: MapsProvider): void => {
  providers[name] = impl;
};

export default createMapsClient;
