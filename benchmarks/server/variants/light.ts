// The http-api workload (variants/raw.ts) on @lightstart/server: the same catalog, carts and
// responses byte for byte, the routing, the query, the headers and the replies through the
// package's App, Context and Reply, served by its node adapter.
import { App, Context, Reply, empty } from "@lightstart/server";
import { serve, type NodeServer } from "@lightstart/server/node";

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

function send(c: Context, status: number, body: string): Reply {
  const reply = new Reply(status);
  reply.headers.append("content-type", "application/json; charset=utf-8");
  reply.headers.append("cache-control", "no-store");
  const requestId = c.header("x-request-id");
  if (requestId !== null) reply.headers.append("x-request-id", requestId);
  reply.text = body;
  return reply;
}

function fail(c: Context, status: number, message: string): Reply {
  const error: ApiError = { error: message, status };
  return send(c, status, JSON.stringify(error));
}

function intParam(c: Context, name: string, fallback: number): number {
  const raw = c.query(name);
  if (raw === null) return fallback;
  const value = parseInt(raw, 10);
  return Number.isNaN(value) || value < 0 ? fallback : value;
}

function listProducts(c: Context): Reply {
  count("list");
  const category = c.query("category") ?? "";
  const source = category === "" ? products : (byCategory.get(category) ?? []);
  const minPrice = intParam(c, "minPrice", 0);
  const offset = intParam(c, "offset", 0);
  const limit = Math.min(intParam(c, "limit", 20), 50);
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
  return send(c, 200, JSON.stringify(page));
}

function getProduct(c: Context): Reply {
  count("product");
  const idText = c.param("id") ?? "";
  const id = parseInt(idText, 10);
  if (Number.isNaN(id) || id < 0 || id >= products.length) return fail(c, 404, "product " + idText + " not found");
  const product = products[id]!;
  const etag = '"p' + product.id + "-v" + product.version + '"';
  if (c.header("if-none-match") === etag) return empty(304).header("etag", etag);
  return send(c, 200, JSON.stringify(product)).header("etag", etag);
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

function authorized(c: Context): boolean {
  const auth = c.header("authorization");
  return auth !== null && auth.startsWith("Bearer ") && auth.length > 12;
}

function getCart(c: Context): Reply {
  count("cart");
  const id = c.param("cart") ?? "";
  const cart = carts.get(id);
  if (cart === undefined) return fail(c, 404, "cart " + id + " not found");
  return send(c, 200, viewCart(cart));
}

async function addToCart(c: Context): Promise<Reply> {
  count("add");
  const body = await c.text();
  if (!authorized(c)) return fail(c, 401, "missing or invalid token");
  const contentType = c.header("content-type");
  if (contentType === null || !contentType.startsWith("application/json")) return fail(c, 415, "expected application/json");
  let item: AddItem;
  try {
    item = JSON.parse(body) as AddItem;
  } catch {
    return fail(c, 400, "malformed JSON body");
  }
  if (item.productId < 0 || item.productId >= products.length || item.qty <= 0) return fail(c, 422, "invalid item");
  const product = products[item.productId]!;
  const cartId = c.param("cart") ?? "";
  let cart = carts.get(cartId);
  if (cart === undefined) {
    cart = { id: cartId, lines: [] };
    carts.set(cartId, cart);
  }
  const existing = cart.lines.find((line) => line.sku === product.sku);
  if (existing !== undefined) existing.qty += item.qty;
  else cart.lines.push({ sku: product.sku, name: product.name, qty: item.qty, unitPrice: product.price });
  return send(c, 201, viewCart(cart));
}

function removeFromCart(c: Context): Reply {
  count("remove");
  if (!authorized(c)) return fail(c, 401, "missing or invalid token");
  const cartId = c.param("cart") ?? "";
  const sku = c.param("sku") ?? "";
  const cart = carts.get(cartId);
  const index = cart === undefined ? -1 : cart.lines.findIndex((line) => line.sku === sku);
  if (cart === undefined || index < 0) return fail(c, 404, "line " + sku + " not in cart " + cartId);
  cart.lines.splice(index, 1);
  return empty(204);
}

class Running {
  server: NodeServer | null = null;
}

const running = new Running();

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

const app = new App()
  .get("/health", (c: Context) => {
    count("health");
    return send(c, 200, '{"ok":true}');
  })
  .get("/products", listProducts)
  .get("/products/:id", getProduct)
  .get("/carts/:cart", getCart)
  .post("/carts/:cart/items", addToCart)
  .delete("/carts/:cart/items/:sku", removeFromCart)
  .post("/shutdown", (c: Context) => {
    requests++;
    const server = running.server;
    if (server !== null)
      setTimeout(() => {
        server.close().then(report);
      }, 0);
    return send(c, 200, '{"bye":true}');
  })
  .notFound((c: Context) => {
    count("unmatched");
    return fail(c, 404, "no route for " + c.method + " " + c.path);
  });

serve(app, { port: 0, host: "127.0.0.1", grace: 2000 }).then((server: NodeServer) => {
  running.server = server;
  process.stderr.write("PORT " + server.port + "\n");
});
