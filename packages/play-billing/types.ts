/**
 * @file What @lightstart/play-billing hands around: the Play Developer API
 * answers it reads, the grant a subscription carries, the product a device
 * sells, and the environment the server's endpoints need.
 */

/** The environment the Play endpoints read. `PLAY_FETCH` stands a fake Play in for a test. */
export interface PlayEnv {
  /** A Google service account's JSON key, with access to the Play Developer API. */
  PLAY_SERVICE_ACCOUNT_JSON?: string;
  /** The app's package name, as the Play Console knows it. */
  PLAY_PACKAGE_NAME?: string;
  /** The token the Pub/Sub push subscription sends as `?token=`. */
  PLAY_RTDN_TOKEN?: string;
  /** The auth secret the account id is an HMAC under. */
  JWT_SECRET?: string;
  /** A fetch to call instead of the page's, so a test can answer for Google. */
  PLAY_FETCH?: typeof fetch;
  [name: string]: unknown;
}

/** The part of Play's `subscriptionsv2` answer this package reads. */
export interface PlaySubscription {
  subscriptionState?: string;
  acknowledgementState?: string;
  lineItems?: Array<{ productId?: string; expiryTime?: string }>;
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string };
}

/** What a subscription grants, read back from Play. */
export interface PlayGrant {
  productId: string;
  expiresAt: string;
  accountId: string;
  acknowledged: boolean;
  pending: boolean;
}

/** A plan as the Play Store sells it on this device: its price as Play writes it, and the free days its offer starts with. */
export interface PlayProduct {
  id: string;
  price: string;
  trialDays: number;
}

/** What `<play-checkout>` is handed. */
export interface PlayCheckoutProps {
  /** The plan id, which is also the Play product id. */
  plan: string;
  /** Called once the server answers, with the purchase's state. */
  done?: ((status: "pending" | "paid", charge: null) => void) | null;
}
