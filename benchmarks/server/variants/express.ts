// The http-api workload (variants/raw.ts) on Express 5: the same catalog, carts and responses
// byte for byte, the routing, query parsing, JSON bodies, ETags and request ids through
// app.get/post/delete, req.params/req.query and res.status().set().send().
import express from "express";
import type { Request, Response } from "express";
import type { Server } from "node:http";

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

function send(req: Request, res: Response, status: number, body: string): void {
  res.status(status);
  res.set("content-type", "application/json; charset=utf-8");
  res.set("cache-control", "no-store");
  const requestId = req.get("x-request-id");
  if (requestId !== undefined) res.set("x-request-id", requestId);
  res.send(body);
}

function fail(req: Request, res: Response, status: number, message: string): void {
  const error: ApiError = { error: message, status };
  send(req, res, status, JSON.stringify(error));
}

function intParam(req: Request, name: string, fallback: number): number {
  const raw = req.query[name];
  if (raw === undefined) return fallback;
  const value = parseInt(String(raw), 10);
  return Number.isNaN(value) || value < 0 ? fallback : value;
}

function listProducts(req: Request, res: Response): void {
  count("list");
  const category = typeof req.query.category === "string" ? req.query.category : "";
  const source = category === "" ? products : (byCategory.get(category) ?? []);
  const minPrice = intParam(req, "minPrice", 0);
  const offset = intParam(req, "offset", 0);
  const limit = Math.min(intParam(req, "limit", 20), 50);
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
  send(req, res, 200, JSON.stringify(page));
}

function getProduct(req: Request, res: Response): void {
  count("product");
  const idText = String(req.params.id ?? "");
  const id = parseInt(idText, 10);
  if (Number.isNaN(id) || id < 0 || id >= products.length) {
    fail(req, res, 404, "product " + idText + " not found");
    return;
  }
  const product = products[id]!;
  const etag = '"p' + product.id + "-v" + product.version + '"';
  if (req.get("if-none-match") === etag) {
    res.status(304).set("etag", etag).end();
    return;
  }
  res.set("etag", etag);
  send(req, res, 200, JSON.stringify(product));
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

function authorized(req: Request): boolean {
  const auth = req.get("authorization");
  return auth !== undefined && auth.startsWith("Bearer ") && auth.length > 12;
}

function getCart(req: Request, res: Response): void {
  count("cart");
  const id = String(req.params.cart ?? "");
  const cart = carts.get(id);
  if (cart === undefined) fail(req, res, 404, "cart " + id + " not found");
  else send(req, res, 200, viewCart(cart));
}

function addToCart(req: Request, res: Response): void {
  count("add");
  if (!authorized(req)) {
    fail(req, res, 401, "missing or invalid token");
    return;
  }
  const contentType = req.get("content-type");
  if (contentType === undefined || !contentType.startsWith("application/json")) {
    fail(req, res, 415, "expected application/json");
    return;
  }
  let item: AddItem;
  try {
    item = JSON.parse(req.body as string) as AddItem;
  } catch {
    fail(req, res, 400, "malformed JSON body");
    return;
  }
  if (item.productId < 0 || item.productId >= products.length || item.qty <= 0) {
    fail(req, res, 422, "invalid item");
    return;
  }
  const product = products[item.productId]!;
  const cartId = String(req.params.cart ?? "");
  let cart = carts.get(cartId);
  if (cart === undefined) {
    cart = { id: cartId, lines: [] };
    carts.set(cartId, cart);
  }
  const existing = cart.lines.find((line) => line.sku === product.sku);
  if (existing !== undefined) existing.qty += item.qty;
  else cart.lines.push({ sku: product.sku, name: product.name, qty: item.qty, unitPrice: product.price });
  send(req, res, 201, viewCart(cart));
}

function removeFromCart(req: Request, res: Response): void {
  count("remove");
  if (!authorized(req)) {
    fail(req, res, 401, "missing or invalid token");
    return;
  }
  const cartId = String(req.params.cart ?? "");
  const sku = String(req.params.sku ?? "");
  const cart = carts.get(cartId);
  const index = cart === undefined ? -1 : cart.lines.findIndex((line) => line.sku === sku);
  if (cart === undefined || index < 0) {
    fail(req, res, 404, "line " + sku + " not in cart " + cartId);
    return;
  }
  cart.lines.splice(index, 1);
  res.status(204).end();
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

const app = express();
app.set("etag", false);
app.disable("x-powered-by");

app.use((req: Request, _res: Response, next) => {
  requests++;
  let body = "";
  req.on("data", (chunk: Buffer) => {
    body += chunk.toString("utf8");
  });
  req.on("end", () => {
    req.body = body;
    next();
  });
});

app.get("/health", (req: Request, res: Response) => {
  count("health");
  send(req, res, 200, '{"ok":true}');
});
app.get("/products", listProducts);
app.get("/products/:id", getProduct);
app.get("/carts/:cart", getCart);
app.post("/carts/:cart/items", addToCart);
app.delete("/carts/:cart/items/:sku", removeFromCart);
app.post("/shutdown", (req: Request, res: Response) => {
  send(req, res, 200, '{"bye":true}');
  const current = server;
  if (current !== null) setTimeout(() => current.close(report), 0);
});
app.use((req: Request, res: Response) => {
  count("unmatched");
  fail(req, res, 404, "no route for " + req.method + " " + req.path);
});

let server: Server | null = app.listen(0, "127.0.0.1", () => {
  const address = server === null ? null : server.address();
  if (address !== null && typeof address === "object") process.stderr.write("PORT " + address.port + "\n");
});
