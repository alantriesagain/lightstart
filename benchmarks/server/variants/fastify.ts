// The http-api workload (variants/raw.ts) on Fastify 5: the same catalog, carts and responses
// byte for byte, the routing, query parsing, JSON bodies, ETags and request ids through
// app.get/post/delete and reply.code().header().send(), with Fastify's built-in JSON parser.
import Fastify, { type FastifyError, type FastifyReply, type FastifyRequest } from "fastify";

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
  requests++;
  routeCounts.set(route, (routeCounts.get(route) ?? 0) + 1);
}

function send(reply: FastifyReply, request: FastifyRequest, status: number, body: string): FastifyReply {
  reply.code(status);
  reply.header("content-type", "application/json; charset=utf-8");
  reply.header("cache-control", "no-store");
  const requestId = request.headers["x-request-id"];
  if (requestId !== undefined) reply.header("x-request-id", String(requestId));
  return reply.send(body);
}

function fail(reply: FastifyReply, request: FastifyRequest, status: number, message: string): FastifyReply {
  const error: ApiError = { error: message, status };
  return send(reply, request, status, JSON.stringify(error));
}

function intParam(query: Record<string, unknown>, name: string, fallback: number): number {
  const raw = query[name];
  if (typeof raw !== "string") return fallback;
  const value = parseInt(raw, 10);
  return Number.isNaN(value) || value < 0 ? fallback : value;
}

function listProducts(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  count("list");
  const query = request.query as Record<string, unknown>;
  const category = typeof query.category === "string" ? query.category : "";
  const source = category === "" ? products : (byCategory.get(category) ?? []);
  const minPrice = intParam(query, "minPrice", 0);
  const offset = intParam(query, "offset", 0);
  const limit = Math.min(intParam(query, "limit", 20), 50);
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
  return send(reply, request, 200, JSON.stringify(page));
}

function getProduct(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  count("product");
  const idText = (request.params as Record<string, string>).id!;
  const id = parseInt(idText, 10);
  if (Number.isNaN(id) || id < 0 || id >= products.length) {
    return fail(reply, request, 404, "product " + idText + " not found");
  }
  const product = products[id]!;
  const etag = '"p' + product.id + "-v" + product.version + '"';
  if (request.headers["if-none-match"] === etag) return reply.code(304).header("etag", etag).send();
  reply.header("etag", etag);
  return send(reply, request, 200, JSON.stringify(product));
}

function viewCart(cart: Cart): string {
  let count = 0;
  let total = 0;
  for (const line of cart.lines) {
    count += line.qty;
    total += line.qty * line.unitPrice;
  }
  const view: CartView = {
    id: cart.id,
    lines: cart.lines,
    count,
    total: Math.round(total * 100) / 100,
  };
  return JSON.stringify(view);
}

function authorized(request: FastifyRequest): boolean {
  const auth = request.headers.authorization;
  return typeof auth === "string" && auth.startsWith("Bearer ") && auth.length > 12;
}

function getCart(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  count("cart");
  const id = (request.params as Record<string, string>).cart!;
  const cart = carts.get(id);
  if (cart === undefined) return fail(reply, request, 404, "cart " + id + " not found");
  return send(reply, request, 200, viewCart(cart));
}

function addToCart(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  count("add");
  if (!authorized(request)) return fail(reply, request, 401, "missing or invalid token");
  const contentType = request.headers["content-type"];
  if (typeof contentType !== "string" || !contentType.startsWith("application/json")) {
    return fail(reply, request, 415, "expected application/json");
  }
  const item = request.body as AddItem;
  if (item.productId < 0 || item.productId >= products.length || item.qty <= 0) {
    return fail(reply, request, 422, "invalid item");
  }
  const product = products[item.productId]!;
  const cartId = (request.params as Record<string, string>).cart!;
  let cart = carts.get(cartId);
  if (cart === undefined) {
    cart = { id: cartId, lines: [] };
    carts.set(cartId, cart);
  }
  const existing = cart.lines.find((line) => line.sku === product.sku);
  if (existing !== undefined) existing.qty += item.qty;
  else cart.lines.push({ sku: product.sku, name: product.name, qty: item.qty, unitPrice: product.price });
  return send(reply, request, 201, viewCart(cart));
}

function removeFromCart(request: FastifyRequest, reply: FastifyReply): FastifyReply {
  count("remove");
  if (!authorized(request)) return fail(reply, request, 401, "missing or invalid token");
  const params = request.params as Record<string, string>;
  const cartId = params.cart!;
  const sku = params.sku!;
  const cart = carts.get(cartId);
  const index = cart === undefined ? -1 : cart.lines.findIndex((line) => line.sku === sku);
  if (cart === undefined || index < 0) return fail(reply, request, 404, "line " + sku + " not in cart " + cartId);
  cart.lines.splice(index, 1);
  return reply.code(204).send();
}

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

const app = Fastify({ logger: false });

app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
  if (error.code === "FST_ERR_CTP_INVALID_JSON_BODY" || error.code === "FST_ERR_CTP_EMPTY_JSON_BODY") {
    if (request.routeOptions?.url === "/carts/:cart/items") count("add");
    reply.removeHeader("connection");
    reply.raw.shouldKeepAlive = true;
    return fail(reply, request, 400, "malformed JSON body");
  }
  return fail(reply, request, error.statusCode ?? 500, error.message);
});

app.get("/health", (request: FastifyRequest, reply: FastifyReply) => {
  count("health");
  return send(reply, request, 200, '{"ok":true}');
});
app.get("/products", listProducts);
app.get("/products/:id", getProduct);
app.get("/carts/:cart", getCart);
app.post("/carts/:cart/items", addToCart);
app.delete("/carts/:cart/items/:sku", removeFromCart);
app.post("/shutdown", (request: FastifyRequest, reply: FastifyReply) => {
  requests++;
  setTimeout(() => {
    app.close().then(report);
  }, 0);
  return send(reply, request, 200, '{"bye":true}');
});
app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
  count("unmatched");
  const url = request.raw.url ?? "/";
  const q = url.indexOf("?");
  const path = q < 0 ? url : url.slice(0, q);
  return fail(reply, request, 404, "no route for " + request.method + " " + path);
});

const host = "127.0.0.1";
await app.listen({ port: 0, host });
const address = app.server.address();
if (address !== null && typeof address === "object") process.stderr.write("PORT " + address.port + "\n");
