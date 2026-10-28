// The http-api workload (variants/raw.ts) as a Fetch handler, `(Request) => Promise<Response>`,
// served through the node-to-Fetch bridge bootstrapp's dev server uses today
// (bootstrapp/packages/serve/src/http.ts): the body read in full, a `Request` built per request, the
// `Response`'s headers written with `Object.fromEntries` and its body read as one buffer. What a
// Fetch-first core costs on node and natively, against raw.ts and light.ts.
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  tags: string[];
  version: number;
}
interface CartLine {
  sku: string;
  name: string;
  qty: number;
  unitPrice: number;
}
interface Cart {
  id: string;
  lines: CartLine[];
}
interface AddItem {
  productId: number;
  qty: number;
}
interface ProductPage {
  category: string;
  total: number;
  offset: number;
  items: ProductSummary[];
}
interface ProductSummary {
  id: number;
  name: string;
  price: number;
  inStock: boolean;
}
interface CartView {
  id: string;
  lines: CartLine[];
  count: number;
  total: number;
}
interface ApiError {
  error: string;
  status: number;
}

let seed = 2024;
function random(): number {
  seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
  return seed / 4294967296;
}

const categories = ["books", "games", "garden", "kitchen", "music", "outdoor", "tools", "toys"];
const adjectives = ["red", "small", "classic", "smart", "eco", "deluxe", "basic", "pro"];
const products: Product[] = [];
const byCategory = new Map<string, Product[]>();
for (let i = 0; i < 2000; i++) {
  const category = categories[i % categories.length]!;
  const product: Product = {
    id: i,
    sku: "sku-" + (100000 + i),
    name: adjectives[Math.floor(random() * adjectives.length)]! + " " + category + " item " + i,
    category,
    price: Math.round(100 + random() * 9900) / 100,
    stock: Math.floor(random() * 40),
    tags: random() < 0.3 ? ["sale", category] : [category],
    version: 1,
  };
  products.push(product);
  let list = byCategory.get(category);
  if (list === undefined) {
    list = [];
    byCategory.set(category, list);
  }
  list.push(product);
}

const carts = new Map<string, Cart>();
const routeCounts = new Map<string, number>();
let requests = 0;

function count(route: string): void {
  routeCounts.set(route, (routeCounts.get(route) ?? 0) + 1);
}

function send(request: Request, status: number, body: string, etag: string): Response {
  const headers = new Headers();
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  const requestId = request.headers.get("x-request-id");
  if (requestId !== null) headers.set("x-request-id", requestId);
  if (etag !== "") headers.set("etag", etag);
  return new Response(body, { status, headers });
}

function fail(request: Request, status: number, message: string): Response {
  const error: ApiError = { error: message, status };
  return send(request, status, JSON.stringify(error), "");
}

function intParam(params: URLSearchParams, name: string, fallback: number): number {
  const raw = params.get(name);
  if (raw === null) return fallback;
  const value = parseInt(raw, 10);
  return Number.isNaN(value) || value < 0 ? fallback : value;
}

function listProducts(request: Request, params: URLSearchParams): Response {
  const category = params.get("category") ?? "";
  const source = category === "" ? products : (byCategory.get(category) ?? []);
  const minPrice = intParam(params, "minPrice", 0);
  const offset = intParam(params, "offset", 0);
  const limit = Math.min(intParam(params, "limit", 20), 50);
  const matching = source.filter((p) => p.price >= minPrice);
  const page: ProductPage = {
    category: category === "" ? "all" : category,
    total: matching.length,
    offset,
    items: matching.slice(offset, offset + limit).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      inStock: p.stock > 0,
    })),
  };
  return send(request, 200, JSON.stringify(page), "");
}

function getProduct(request: Request, idText: string): Response {
  const id = parseInt(idText, 10);
  if (Number.isNaN(id) || id < 0 || id >= products.length) return fail(request, 404, "product " + idText + " not found");
  const product = products[id]!;
  const etag = '"p' + product.id + "-v" + product.version + '"';
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { etag } });
  return send(request, 200, JSON.stringify(product), etag);
}

function viewCart(cart: Cart): string {
  let units = 0;
  let total = 0;
  for (const line of cart.lines) {
    units += line.qty;
    total += line.qty * line.unitPrice;
  }
  const view: CartView = {
    id: cart.id,
    lines: cart.lines,
    count: units,
    total: Math.round(total * 100) / 100,
  };
  return JSON.stringify(view);
}

function authorized(request: Request): boolean {
  const auth = request.headers.get("authorization");
  return auth !== null && auth.startsWith("Bearer ") && auth.length > 12;
}

async function addToCart(request: Request, cartId: string): Promise<Response> {
  const body = await request.text();
  if (!authorized(request)) return fail(request, 401, "missing or invalid token");
  const contentType = request.headers.get("content-type");
  if (contentType === null || !contentType.startsWith("application/json")) return fail(request, 415, "expected application/json");
  let item: AddItem;
  try {
    item = JSON.parse(body) as AddItem;
  } catch {
    return fail(request, 400, "malformed JSON body");
  }
  if (item.productId < 0 || item.productId >= products.length || item.qty <= 0) return fail(request, 422, "invalid item");
  const product = products[item.productId]!;
  let cart = carts.get(cartId);
  if (cart === undefined) {
    cart = { id: cartId, lines: [] };
    carts.set(cartId, cart);
  }
  const existing = cart.lines.find((line) => line.sku === product.sku);
  if (existing !== undefined) existing.qty += item.qty;
  else cart.lines.push({ sku: product.sku, name: product.name, qty: item.qty, unitPrice: product.price });
  return send(request, 201, viewCart(cart), "");
}

function removeFromCart(request: Request, cartId: string, sku: string): Response {
  if (!authorized(request)) return fail(request, 401, "missing or invalid token");
  const cart = carts.get(cartId);
  const index = cart === undefined ? -1 : cart.lines.findIndex((line) => line.sku === sku);
  if (cart === undefined || index < 0) return fail(request, 404, "line " + sku + " not in cart " + cartId);
  cart.lines.splice(index, 1);
  return new Response(null, { status: 204 });
}

class Shutdown {
  requested = false;
}

const shutdown = new Shutdown();

async function handle(request: Request): Promise<Response> {
  requests++;
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;
  const parts = path.split("/").filter((s) => s !== "");

  if (method === "GET" && path === "/health") {
    count("health");
    return send(request, 200, '{"ok":true}', "");
  }
  if (method === "GET" && path === "/products") {
    count("list");
    return listProducts(request, url.searchParams);
  }
  if (method === "GET" && parts.length === 2 && parts[0] === "products") {
    count("product");
    return getProduct(request, parts[1]!);
  }
  if (method === "GET" && parts.length === 2 && parts[0] === "carts") {
    count("cart");
    const cart = carts.get(parts[1]!);
    return cart === undefined ? fail(request, 404, "cart " + parts[1]! + " not found") : send(request, 200, viewCart(cart), "");
  }
  if (method === "POST" && parts.length === 3 && parts[0] === "carts" && parts[2] === "items") {
    count("add");
    return addToCart(request, parts[1]!);
  }
  if (method === "DELETE" && parts.length === 4 && parts[0] === "carts" && parts[2] === "items") {
    count("remove");
    return removeFromCart(request, parts[1]!, parts[3]!);
  }
  if (method === "POST" && path === "/shutdown") {
    shutdown.requested = true;
    return send(request, 200, '{"bye":true}', "");
  }
  count("unmatched");
  return fail(request, 404, "no route for " + method + " " + path);
}

const readBody = (req: IncomingMessage): Promise<Buffer> =>
  new Promise((resolve: (body: Buffer) => void) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });

const toFetchRequest = async (req: IncomingMessage): Promise<Request> => {
  const headers = new Headers();
  const raw = req.rawHeaders;
  for (let i = 0; i + 1 < raw.length; i += 2) headers.append(raw[i]!, raw[i + 1]!);
  const method = req.method ?? "GET";
  const url = "http://" + (req.headers.host ?? "localhost") + (req.url ?? "/");
  if (method === "GET" || method === "HEAD") return new Request(url, { method, headers });
  const body = await readBody(req);
  return new Request(url, { method, headers, body });
};

const fromFetchResponse = async (response: Response, res: ServerResponse): Promise<void> => {
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
};

function report(): void {
  let lines = 0;
  let units = 0;
  for (const cart of carts.values()) {
    lines += cart.lines.length;
    for (const line of cart.lines) units += line.qty;
  }
  const names = [...routeCounts.keys()].sort();
  console.log("requests " + requests);
  for (const name of names) console.log("  " + name + " " + routeCounts.get(name)!);
  console.log("carts " + carts.size + " lines " + lines + " units " + units);
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  toFetchRequest(req)
    .then(handle)
    .then((response: Response) => fromFetchResponse(response, res))
    .then(() => {
      if (shutdown.requested) server.close(report);
    });
});

server.listen(0, "127.0.0.1", () => {
  /* @ts-expect-error */
  process.stderr.write("PORT " + server.address().port + "\n");
});
