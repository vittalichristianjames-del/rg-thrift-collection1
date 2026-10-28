import { randomUUID } from "node:crypto";
import "dotenv/config";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const requiredEnv = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missingEnv = requiredEnv.filter(name => !process.env[name]);
if (missingEnv.length) {
  throw new Error(`Missing required environment variables: ${missingEnv.join(", ")}`);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});
const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);
const imageStorage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2 }
});
const receiptStorage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 }
});
const publicLimiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-8", legacyHeaders: false });
const orderLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 12, standardHeaders: "draft-8", legacyHeaders: false });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validStatuses = new Set([
  "Payment review", "Pending COD", "Paid", "Processing",
  "Shipped", "Delivered", "Cancelled", "Rejected"
]);

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("This website origin is not allowed by the API."));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(express.json({ limit: "100kb" }));

function fail(response, status, message) {
  return response.status(status).json({ error: message });
}

function handleError(response, error) {
  console.error(error);
  return fail(response, error.status || 500, error.status ? error.message : "The server could not complete that request.");
}

function validateUuid(value, field) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    const error = new Error(`${field} must be a valid UUID.`);
    error.status = 400;
    throw error;
  }
}

function validateImage(file, acceptedTypes) {
  if (!file || !acceptedTypes.includes(file.mimetype)) {
    const error = new Error("Upload a supported JPEG, PNG, or WEBP image.");
    error.status = 400;
    throw error;
  }
  const bytes = file.buffer;
  const validJpeg = file.mimetype === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  const validPng = file.mimetype === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const validWebp = file.mimetype === "image/webp" && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!validJpeg && !validPng && !validWebp) {
    const error = new Error("The uploaded file does not match its declared image type.");
    error.status = 400;
    throw error;
  }
}

function uploadExtension(mimeType) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[mimeType];
}

function asyncRoute(handler) {
  return (request, response) => Promise.resolve(handler(request, response)).catch(error => handleError(response, error));
}

async function getAuthenticatedUser(request, optional = false) {
  const authorization = request.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) {
    if (optional) return null;
    const error = new Error("Sign in to continue.");
    error.status = 401;
    throw error;
  }

  const { data, error: authError } = await supabase.auth.getUser(token);
  if (authError || !data.user) {
    const error = new Error("Your sign-in has expired. Please sign in again.");
    error.status = 401;
    throw error;
  }
  return data.user;
}

async function requireCustomerAuth(request, response, next) {
  try {
    request.user = await getAuthenticatedUser(request);
    return next();
  } catch (error) {
    return handleError(response, error);
  }
}

async function requireAdminAuth(request, response, next) {
  let user;
  try {
    user = await getAuthenticatedUser(request);
  } catch (error) {
    return handleError(response, error);
  }
  const { data: adminData, error } = await supabase
    .from("store_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return handleError(response, error);
  if (!adminData) return fail(response, 403, "This account is not authorized as a store admin.");
  request.user = user;
  return next();
}

function parseMeasurements(value) {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      const error = new Error("Measurements must be valid JSON.");
      error.status = 400;
      throw error;
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const error = new Error("Measurements must be an object.");
    error.status = 400;
    throw error;
  }
  return Object.fromEntries(Object.entries(value)
    .filter(([label, measurement]) => typeof label === "string" && typeof measurement === "string")
    .map(([label, measurement]) => [label.trim().slice(0, 60), measurement.trim().slice(0, 60)])
    .filter(([label, measurement]) => label && measurement)
    .slice(0, 24));
}

function validateProduct(body) {
  const title = String(body.title || "").trim();
  const category = String(body.category || "").trim();
  const size = String(body.size || "").trim();
  const condition = String(body.condition || "").trim();
  const image = String(body.image || "").trim();
  const backImage = String(body.back_image || "").trim();
  const price = Number(body.price);
  const stock = Number(body.stock);
  const isActive = body.is_active === undefined
    ? true
    : body.is_active === true || body.is_active === "true";
  const isFeatured = body.is_featured === true || body.is_featured === "true";
  if (body.is_active !== undefined && ![true, false, "true", "false"].includes(body.is_active)) {
    const error = new Error("Choose a valid inventory visibility setting.");
    error.status = 400;
    throw error;
  }
  if (body.is_featured !== undefined && ![true, false, "true", "false"].includes(body.is_featured)) {
    const error = new Error("Choose a valid featured setting.");
    error.status = 400;
    throw error;
  }
  if (!title || title.length > 120 || !category || category.length > 60
    || !size || size.length > 40 || !condition || condition.length > 80
    || !Number.isFinite(price) || price <= 0 || !Number.isInteger(stock) || stock < 0) {
    const error = new Error("Enter a valid title, category, price, size, condition, and stock.");
    error.status = 400;
    throw error;
  }
  if (!image) {
    const error = new Error("Add a photo URL or upload a product photo.");
    error.status = 400;
    throw error;
  }
  return {
    title,
    category,
    price,
    size,
    condition,
    tag: String(body.tag || "JUST FOUND").trim().slice(0, 50),
    image,
    back_image: backImage,
    description: String(body.description || "A one-of-a-kind pre-loved piece, ready for its next favorite person.").trim().slice(0, 1000),
    measurements: parseMeasurements(body.measurements),
    stock,
    is_active: isActive,
    is_featured: isFeatured
  };
}

async function listProducts(admin = false) {
  let query = supabase.from("products").select("*").order("created_at");
  if (!admin) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(product => ({
    ...product,
    is_available: product.is_active && product.stock > 0
  }));
}

app.get("/api/health", (_request, response) => response.json({ status: "ok" }));

app.get("/api/products", publicLimiter, asyncRoute(async (_request, response) => {
  response.json(await listProducts());
}));

app.post("/api/orders", orderLimiter, receiptStorage.single("receipt"), asyncRoute(async (request, response) => {
  request.user = await getAuthenticatedUser(request);
  let productIds;
  try {
    productIds = JSON.parse(request.body.productIds);
  } catch {
    return fail(response, 400, "Your bag is invalid. Please refresh and try again.");
  }
  if (!Array.isArray(productIds) || !productIds.length || productIds.length > 12
    || productIds.some(id => typeof id !== "string" || id.length > 100)) {
    return fail(response, 400, "Your bag is empty or invalid.");
  }
  validateUuid(request.body.checkoutToken, "Checkout token");
  const customer = {
    name: String(request.body.name || "").trim(),
    email: String(request.body.email || "").trim(),
    phone: String(request.body.phone || "").trim(),
    address: String(request.body.address || "").trim()
  };
  if (!customer.name || customer.name.length > 120 || !emailPattern.test(customer.email)
    || customer.email.length > 254 || !customer.phone || customer.phone.length > 40
    || !customer.address || customer.address.length > 1000) {
    return fail(response, 400, "Enter a valid name, email, phone number, and shipping address.");
  }
  const payment = request.body.payment;
  const destination = request.body.destination;
  if (!["COD", "GCash"].includes(payment) || !["metro", "luzon", "vismin"].includes(destination)) {
    return fail(response, 400, "Choose a valid payment method and shipping destination.");
  }
  if (payment === "GCash" && !request.file) return fail(response, 400, "Upload the GCash payment receipt.");

  let receiptPath = null;
  if (request.file) {
    validateImage(request.file, ["image/jpeg", "image/png"]);
    if (payment !== "GCash") return fail(response, 400, "Receipts are only accepted for GCash orders.");
    receiptPath = `${request.body.checkoutToken}/${randomUUID()}.${uploadExtension(request.file.mimetype)}`;
    const { error: uploadError } = await supabase.storage.from("gcash-receipts").upload(
      receiptPath,
      request.file.buffer,
      { contentType: request.file.mimetype, upsert: false }
    );
    if (uploadError) throw uploadError;
  }

  const { data, error } = await supabase.rpc("create_order", {
    p_customer: customer,
    p_payment_method: payment,
    p_destination: destination,
    p_reference: request.body.reference || "",
    p_receipt_path: receiptPath,
    p_product_ids: productIds,
    p_reservation_token: request.body.checkoutToken,
    p_customer_id: request.user.id
  });
  if (error) {
    if (receiptPath) {
      const { error: cleanupError } = await supabase.storage.from("gcash-receipts").remove([receiptPath]);
      if (cleanupError) console.error("Could not remove receipt for rejected order:", cleanupError);
    }
    return fail(response, 409, error.message);
  }
  response.status(201).json(data);
}));

app.get("/api/customer/orders", publicLimiter, requireCustomerAuth, asyncRoute(async (request, response) => {
  const { data, error } = await supabase.from("orders")
    .select("*, order_items(*)")
    .eq("customer_id", request.user.id)
    .order("placed_at", { ascending: false });
  if (error) throw error;
  response.json(data);
}));

app.post("/api/orders/lookup", publicLimiter, asyncRoute(async (request, response) => {
  const orderNumber = String(request.body.orderNumber || "").trim();
  const email = String(request.body.email || "").trim();
  if (!/^RW-[A-F0-9]{16}$/i.test(orderNumber) || !emailPattern.test(email) || email.length > 254) {
    return fail(response, 400, "Enter a valid order number and checkout email.");
  }
  const { data, error } = await supabase.rpc("lookup_order", {
    p_order_number: orderNumber,
    p_email: email
  });
  if (error) return fail(response, 404, "No order matches that order number and email.");
  response.json(data);
}));

app.get("/api/admin/me", requireAdminAuth, (_request, response) => response.json({ isAdmin: true }));

app.get("/api/admin/products", requireAdminAuth, asyncRoute(async (_request, response) => {
  response.json(await listProducts(true));
}));

async function saveProduct(request, response) {
  const frontImageFile = request.files?.imageFile?.[0];
  const backImageFile = request.files?.backImageFile?.[0];
  const product = validateProduct({
    ...request.body,
    image: frontImageFile ? "uploaded-image" : request.body.image,
    back_image: backImageFile ? "uploaded-image" : request.body.back_image
  });
  const imageFiles = [frontImageFile, backImageFile].filter(Boolean);
  for (const file of imageFiles) validateImage(file, ["image/jpeg", "image/png", "image/webp"]);
  const imagePaths = [];
  try {
    for (const [file, field] of [[frontImageFile, "image"], [backImageFile, "back_image"]]) {
      if (!file) continue;
      const imagePath = `${randomUUID()}.${uploadExtension(file.mimetype)}`;
      const { error } = await supabase.storage.from("product-images").upload(
        imagePath,
        file.buffer,
        { contentType: file.mimetype, upsert: false }
      );
      if (error) throw error;
      imagePaths.push(imagePath);
      product[field] = supabase.storage.from("product-images").getPublicUrl(imagePath).data.publicUrl;
    }
  } catch (error) {
    if (imagePaths.length) {
      const { error: cleanupError } = await supabase.storage.from("product-images").remove(imagePaths);
      if (cleanupError) console.error("Could not remove product photos after upload failure:", cleanupError);
    }
    throw error;
  }
  if (request.method === "PUT" && !request.params.id) return fail(response, 400, "Product ID is required.");
  const values = {
    ...product,
    ...(request.method === "PUT" ? { id: request.params.id } : {}),
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from("products").upsert(values).select("*").single();
  if (error) {
    if (imagePaths.length) {
      const { error: cleanupError } = await supabase.storage.from("product-images").remove(imagePaths);
      if (cleanupError) console.error("Could not remove photos for rejected product:", cleanupError);
    }
    throw error;
  }
  response.status(request.method === "POST" ? 201 : 200).json(data);
}

const productImageFields = imageStorage.fields([
  { name: "imageFile", maxCount: 1 },
  { name: "backImageFile", maxCount: 1 }
]);
app.post("/api/admin/products", requireAdminAuth, productImageFields, asyncRoute(saveProduct));
app.put("/api/admin/products/:id", requireAdminAuth, productImageFields, asyncRoute(saveProduct));

app.patch("/api/admin/products/:id/status", requireAdminAuth, asyncRoute(async (request, response) => {
  const status = request.body.status;
  if (!["featured", "available", "sold-out", "hidden"].includes(status)) {
    return fail(response, 400, "Choose Featured, Available, Sold out, or Hide.");
  }
  const { data: existing, error: lookupError } = await supabase
    .from("products")
    .select("id, stock")
    .eq("id", request.params.id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (!existing) return fail(response, 404, "Product not found.");
  if (status === "featured" && existing.stock < 1) {
    return fail(response, 409, "Restock this piece before featuring it.");
  }

  const update = {
    updated_at: new Date().toISOString(),
    ...(status === "featured" ? { is_active: true, is_featured: true } : {}),
    ...(status === "available" ? { is_active: true, is_featured: false, stock: Math.max(existing.stock, 1) } : {}),
    ...(status === "sold-out" ? { is_active: true, is_featured: false, stock: 0 } : {}),
    ...(status === "hidden" ? { is_active: false, is_featured: false } : {})
  };
  const { data, error } = await supabase.from("products")
    .update(update)
    .eq("id", request.params.id)
    .select("*")
    .single();
  if (error) throw error;
  response.json(data);
}));

app.delete("/api/admin/products/:id", requireAdminAuth, asyncRoute(async (request, response) => {
  const { data, error } = await supabase.from("products")
    .delete()
    .eq("id", request.params.id)
    .select("id")
    .maybeSingle();
  if (error?.code === "23503") {
    return fail(response, 409, "This piece is part of an order record and cannot be permanently deleted. Hide it from the shop instead.");
  }
  if (error) throw error;
  if (!data) return fail(response, 404, "Product not found.");
  response.status(204).end();
}));

app.get("/api/admin/orders", requireAdminAuth, asyncRoute(async (_request, response) => {
  const { data, error } = await supabase.from("orders").select("*, order_items(*)").order("placed_at", { ascending: false });
  if (error) throw error;
  response.json(data);
}));

app.get("/api/admin/orders/:id/receipt", requireAdminAuth, asyncRoute(async (request, response) => {
  const { data: order, error: orderError } = await supabase.from("orders")
    .select("receipt_path")
    .eq("id", request.params.id)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order?.receipt_path) return fail(response, 404, "No receipt is attached to this order.");
  const { data, error } = await supabase.storage.from("gcash-receipts").createSignedUrl(order.receipt_path, 60);
  if (error) throw error;
  response.json({ url: data.signedUrl });
}));

app.patch("/api/admin/orders/:id", requireAdminAuth, asyncRoute(async (request, response) => {
  const { status, courier, tracking, eta } = request.body;
  if (status !== undefined && !validStatuses.has(status)) return fail(response, 400, "Choose a valid order status.");
  const { error } = await supabase.rpc("admin_update_order", {
    p_order_id: request.params.id,
    p_status: status ?? null,
    p_courier: courier ?? null,
    p_tracking_number: tracking ?? null,
    p_estimated_delivery: eta ?? null
  });
  if (error) return fail(response, 400, error.message);
  response.status(204).end();
}));

app.use("/api", (_request, response) => fail(response, 404, "API route not found."));
app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError) {
    return fail(response, error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
      error.code === "LIMIT_FILE_SIZE" ? "Image uploads must be 5 MB or smaller." : error.message);
  }
  if (error.message?.includes("origin is not allowed")) return fail(response, 403, error.message);
  return handleError(response, error);
});

app.listen(port, () => console.log(`RG Thrift API listening on port ${port}`));
