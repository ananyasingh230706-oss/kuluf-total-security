require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const cookieParser = require("cookie-parser");
const db = require("./db");
const emailTransporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: process.env.SMTP_SECURE !== "false",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});



function isGmailAddress(email) {
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i.test(
    String(email || "").trim()
  );
}


function generateEmailOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashEmailOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

function getEmailOtpExpiry() {
  return new Date(Date.now() + 10 * 60 * 1000).toISOString();
}

function saveEmailOtp(userId, otp) {
  const token = hashEmailOtp(otp);
  const expiresAt = getEmailOtpExpiry();

  const existing = db.prepare(`
    SELECT id
    FROM email_verifications
    WHERE user_id = ? AND verified_at IS NULL
    ORDER BY id DESC
    LIMIT 1
  `).get(userId);

  if (existing) {
    db.prepare(`
      UPDATE email_verifications
      SET token = ?, expires_at = ?, created_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(token, expiresAt, existing.id);
  } else {
    db.prepare(`
      INSERT INTO email_verifications (user_id, token, expires_at)
      VALUES (?, ?, ?)
    `).run(userId, token, expiresAt);
  }
}



async function sendEmailOtp(email, otp) {
  await emailTransporter.sendMail({
    from: `"KULUF Total Security" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Verify your KULUF account",
    text: `Your KULUF verification code is ${otp}. It expires in 10 minutes. Do not share this code with anyone.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-inline-size:520px;margin:auto;padding:24px">
        <h2>KULUF Total Security</h2>
        <p>Use this code to verify your email address:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px 0">${otp}</div>
        <p>This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
      </div>
    `,
  });
}

/* =========================================================
   ENVIRONMENT VALIDATION
   ========================================================= */

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === "replace-with-a-long-random-secret") {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET is not set or is using the default value. Set a strong JWT_SECRET in .env before running in production.");
    process.exit(1);
  } else {
    console.warn("WARNING: JWT_SECRET is using a default value. Set a strong secret in .env for production.");
  }
}
const SECRET = JWT_SECRET || "dev-secret-change-me-not-for-production";

const PORT = process.env.PORT || 4000;

/* =========================================================
   APP
   ========================================================= */

const app = express();

/* =========================================================
   SECURITY HEADERS
   ========================================================= */

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://api.razorpay.com; frame-src https://api.razorpay.com https://checkout.razorpay.com"
  );
  next();
});

/* =========================================================
   CORS
   ========================================================= */


const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:4000"];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(cookieParser());


/* =========================================================
   RATE LIMITING (manual, no extra dependency)
   ========================================================= */

const rateLimitStore = new Map();

function rateLimit(maxRequests, windowMs) {
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress || "unknown";
    const now = Date.now();
    const record = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };

    if (now > record.resetAt) {
      record.count = 0;
      record.resetAt = now + windowMs;
    }

    record.count += 1;
    rateLimitStore.set(key, record);

    if (record.count > maxRequests) {
      return res.status(429).json({ error: "Too many requests. Please try again later." });
    }

    next();
  };
}

// Clean up store every 5 minutes to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore) {
    if (now > record.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);



/* =========================================================
   BODY PARSING
   ========================================================= */

// Raw body needed for Razorpay webhook signature verification
app.use("/api/payments/razorpay/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.post("/api/auth/verify-email", rateLimit(10, 15 * 60 * 1000), (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const otp = String(req.body.otp || "").trim();

  if (!isGmailAddress(email)) {
    return res.status(400).json({ error: "A valid Gmail address is required" });
  }

  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: "Enter the six-digit verification code" });
  }

  const user = db.prepare(`
    SELECT id, name, email, role, phone, email_verified
    FROM users
    WHERE email = ?
  `).get(email);

  if (!user) {
    return res.status(400).json({ error: "Invalid or expired verification code" });
  }

  if (Number(user.email_verified) === 1) {
    return res.json({ message: "Email is already verified. You can sign in." });
  }

  const verification = db.prepare(`
    SELECT id, token, expires_at
    FROM email_verifications
    WHERE user_id = ? AND verified_at IS NULL
    ORDER BY id DESC
    LIMIT 1
  `).get(user.id);

  if (
    !verification ||
    Date.parse(verification.expires_at) <= Date.now() ||
    hashEmailOtp(otp) !== verification.token
  ) {
    return res.status(400).json({ error: "Invalid or expired verification code" });
  }

  const completeVerification = db.transaction(() => {
    db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(user.id);
    db.prepare(`
      UPDATE email_verifications
      SET verified_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(verification.id);
  });

  completeVerification();

  return res.json({
    message: "Email verified successfully. You can now sign in.",
  });
});

/* =========================================================
   UPLOADS
   ========================================================= */

const uploadDir = path.join(__dirname, "uploads");
fs.mkdirSync(uploadDir, { recursive: true });
app.use("/uploads", express.static(uploadDir));

/* =========================================================
   MULTER STORAGE
   ========================================================= */

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 60);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const imageFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed."));
  }
};

const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* =========================================================
   AUTH HELPERS
   ========================================================= */

function tokenFor(user) {
  return jwt.sign({ id: user.id, role: user.role, email: user.email }, SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    req.user = jwt.verify(header.slice(7), SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(header.slice(7), SECRET);
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}

function admin(req, res, next) {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function makeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function log(userId, action) {
  try {
    db.prepare("INSERT INTO activity_log (user_id, action) VALUES (?, ?)").run(userId, action);
  } catch { /* non-critical */ }
}

function productRow(product) {
  const images = db
    .prepare("SELECT * FROM product_images WHERE product_id=? ORDER BY is_primary DESC, sort_order, id")
    .all(product.id);
  return { ...product, images };
}

/* =========================================================
   CART HELPER
   ========================================================= */


function cartFor(req) {
  const userId = req.user?.id ?? null;
  const sessionId = req.headers["x-session-id"] || "guest";

  // Logged-in users should always use their own cart.
  if (userId !== null) {
    let cart = db
      .prepare("SELECT * FROM carts WHERE user_id = ? LIMIT 1")
      .get(userId);

    if (cart) {
      return cart;
    }

    const result = db
      .prepare("INSERT INTO carts (user_id, session_id) VALUES (?, ?)")
      .run(userId, sessionId);

    return { id: result.lastInsertRowid, user_id: userId, session_id: sessionId };
  }

  // Guests use their session-specific cart.
  let cart = db
    .prepare(
      "SELECT * FROM carts WHERE user_id IS NULL AND session_id = ? LIMIT 1"
    )
    .get(sessionId);

  if (cart) {
    return cart;
  }

  const result = db
    .prepare("INSERT INTO carts (user_id, session_id) VALUES (NULL, ?)")
    .run(sessionId);

  return {
    id: result.lastInsertRowid,
    user_id: null,
    session_id: sessionId,
  };
}


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get("/api/health", (req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ ok: true, service: "KULUF API", timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ ok: false, service: "KULUF API", error: "Database unavailable" });
  }
});

/* =========================================================
   AUTH ROUTES
   ========================================================= */


app.post("/api/auth/login", rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    return res.status(400).json({
      error: "Gmail address and password are required.",
    });
  }

  if (!isGmailAddress(email)) {
    return res.status(400).json({
      error: "Please use a valid @gmail.com address.",
    });
  }

  try {
    const user = db.prepare(`
      SELECT id, name, email, password_hash, role, phone, email_verified
      FROM users
      WHERE email = ?
    `).get(email);

    // Use the same error for unknown accounts and incorrect passwords.
    if (!user || !user.password_hash) {
      return res.status(401).json({
        error: "Invalid Gmail address or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        error: "Invalid Gmail address or password.",
      });
    }

    if (Number(user.email_verified) !== 1) {
      return res.status(403).json({
        error: "Please verify your email address before signing in.",
        requiresVerification: true,
        email: user.email,
      });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || "",
    };

    const token = tokenFor(safeUser);

    return res.json({
      message: "Login successful.",
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error("Login failed:", error.message);

    return res.status(500).json({
      error: "Unable to sign in right now. Please try again.",
    });
  }
});


app.post("/api/auth/register", rateLimit(10, 15 * 60 * 1000), async (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const phone = String(req.body.phone || "").trim();

  if (!name || !email || !password) {
    return res.status(400).json({
      error: "Name, Gmail address and password are required",
    });
  }

  if (!isGmailAddress(email)) {
    return res.status(400).json({
      error: "Please use a valid @gmail.com address",
    });
  }

  if (name.length > 100 || email.length > 200 ||
      password.length > 128 || phone.length > 30) {
    return res.status(400).json({ error: "Input too long" });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: "Password must be at least 8 characters",
    });
  }

  try {
    const existingUser = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .get(email);

    if (existingUser) {
      return res.status(409).json({
        error: "An account with this Gmail address already exists. Please sign in or use password recovery.",
      });
    }

    const hash = bcrypt.hashSync(password, 12);

    const result = db.prepare(`
      INSERT INTO users
        (name, email, password_hash, phone, email_verified)
      VALUES (?, ?, ?, ?, 0)
    `).run(name, email, hash, phone);

    const userId = Number(result.lastInsertRowid);
    const otp = generateEmailOtp();

    try {
      saveEmailOtp(userId, otp);
      await sendEmailOtp(email, otp);
    } catch (emailError) {
      db.prepare("DELETE FROM users WHERE id = ?").run(userId);
      console.error("Signup verification email failed:", emailError.message);

      return res.status(503).json({
        error: "We couldn't send the verification email. Please try again later.",
      });
    }

    return res.status(201).json({
      message: "Verification code sent to your Gmail address. It expires in 10 minutes.",
      requiresVerification: true,
      email,
    });
  } catch (error) {
    console.error("Registration failed:", error.message);

    if (String(error.code || "").startsWith("SQLITE_CONSTRAINT")) {
      return res.status(409).json({
        error: "An account with this Gmail address already exists.",
      });
    }

    return res.status(500).json({
      error: "Unable to create your account right now. Please try again.",
    });
  }
});


/* =========================================================
   PUBLIC CONTENT
   ========================================================= */

app.get("/api/content", (req, res) => {
  const rows = db.prepare("SELECT key, value FROM site_content").all();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

app.get("/api/settings", (req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

/* =========================================================
   CATEGORIES
   ========================================================= */

app.get("/api/categories", (req, res) => {
  const categories = db
    .prepare("SELECT * FROM categories WHERE active=1 ORDER BY sort_order, id")
    .all();
  res.json(categories);
});

/* =========================================================
   PRODUCTS
   ========================================================= */

app.get("/api/products", (req, res) => {
  const { category, search, featured, bestseller, newArrival, sort, limit, offset } = req.query;

  let sql = `
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id=p.category_id
    WHERE p.status='active'
  `;
  const args = [];

  if (category) {
    sql += " AND c.slug=?";
    args.push(category);
  }

  if (search) {
    sql += " AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ? OR p.short_description LIKE ?)";
    const q = `%${search}%`;
    args.push(q, q, q, q);
  }

  if (featured === "1") sql += " AND p.featured=1";
  if (bestseller === "1") sql += " AND p.bestseller=1";
  if (newArrival === "1") sql += " AND p.new_arrival=1";

  if (sort === "price_asc") {
    sql += " ORDER BY COALESCE(p.sale_price, p.price) ASC";
  } else if (sort === "price_desc") {
    sql += " ORDER BY COALESCE(p.sale_price, p.price) DESC";
  } else if (sort === "newest") {
    sql += " ORDER BY p.created_at DESC";
  } else {
    sql += " ORDER BY p.featured DESC, p.created_at DESC";
  }

  if (limit) {
    sql += " LIMIT ?";
    args.push(Number(limit));
    if (offset) {
      sql += " OFFSET ?";
      args.push(Number(offset));
    }
  }

  const products = db.prepare(sql).all(...args).map(productRow);
  res.json(products);
});

app.get("/api/products/:slug", (req, res) => {
  const product = db
    .prepare(`
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON c.id=p.category_id
      WHERE p.slug=?
    `)
    .get(req.params.slug);

  if (!product) return res.status(404).json({ error: "Product not found" });
  res.json(productRow(product));
});

/* =========================================================
   CART
   ========================================================= */

app.get("/api/cart", optionalAuth, (req, res) => {
  const cart = cartFor(req);
  const items = db
    .prepare(`
      SELECT
        ci.id AS cart_item_id,
        ci.quantity,
        p.*
      FROM cart_items ci
      JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = ?
    `)
    .all(cart.id);

  res.json({ id: cart.id, items });
});

app.post("/api/cart/items", optionalAuth, (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const qty = Math.max(1, Number(quantity));
  const cart = cartFor(req);

  const product = db
    .prepare("SELECT * FROM products WHERE id=? AND status='active'")
    .get(productId);

  if (!product) return res.status(404).json({ error: "Product not found" });

  // Check stock including what's already in cart
  const existing = db
    .prepare("SELECT quantity FROM cart_items WHERE cart_id=? AND product_id=?")
    .get(cart.id, productId);
  const existingQty = existing ? existing.quantity : 0;

  if (product.stock < existingQty + qty) {
    return res.status(400).json({ error: `Insufficient stock. Only ${product.stock - existingQty} more available.` });
  }

  db.prepare(`
    INSERT INTO cart_items (cart_id, product_id, quantity)
    VALUES (?, ?, ?)
    ON CONFLICT(cart_id, product_id)
    DO UPDATE SET quantity = cart_items.quantity + excluded.quantity
  `).run(cart.id, productId, qty);

  res.json({ ok: true });
});

app.patch("/api/cart/items/:id", optionalAuth, (req, res) => {
  const cart = cartFor(req);
  const quantity = Math.max(1, Number(req.body.quantity || 1));

  // Validate against stock
  const item = db
    .prepare("SELECT ci.*, p.stock FROM cart_items ci JOIN products p ON p.id=ci.product_id WHERE ci.id=? AND ci.cart_id=?")
    .get(req.params.id, cart.id);

  if (!item) return res.status(404).json({ error: "Cart item not found" });
  if (quantity > item.stock) {
    return res.status(400).json({ error: `Only ${item.stock} in stock` });
  }

  db.prepare("UPDATE cart_items SET quantity=? WHERE id=? AND cart_id=?").run(quantity, req.params.id, cart.id);
  res.json({ ok: true });
});

app.delete("/api/cart/items/:id", optionalAuth, (req, res) => {
  const cart = cartFor(req);
  const result = db
    .prepare("DELETE FROM cart_items WHERE id=? AND cart_id=?")
    .run(req.params.id, cart.id);

  if (result.changes === 0) {
    return res.status(404).json({ ok: false, error: "Cart item not found" });
  }
  res.json({ ok: true });
});

app.delete("/api/cart", optionalAuth, (req, res) => {
  const cart = cartFor(req);
  db.prepare("DELETE FROM cart_items WHERE cart_id=?").run(cart.id);
  res.json({ ok: true });
});

/* =========================================================
   COUPONS (Customer-facing)
   ========================================================= */

app.post("/api/cart/coupon", auth, (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ error: "Coupon code is required" });

  const coupon = db.prepare("SELECT * FROM coupons WHERE code=? AND active=1").get(String(code).toUpperCase().trim());

  if (!coupon) return res.status(404).json({ error: "Invalid or expired coupon code" });

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return res.status(400).json({ error: "This coupon has expired" });
  }

  if (coupon.usage_limit && coupon.used_count >= coupon.usage_limit) {
    return res.status(400).json({ error: "This coupon has reached its usage limit" });
  }

  const orderSubtotal = Number(subtotal || 0);
  if (orderSubtotal < Number(coupon.min_order || 0)) {
    return res.status(400).json({ error: `Minimum order value of ₹${coupon.min_order} required` });
  }

  let discount = 0;
  if (coupon.type === "percent") {
    discount = (orderSubtotal * coupon.amount) / 100;
    if (coupon.max_discount) discount = Math.min(discount, coupon.max_discount);
  } else {
    discount = coupon.amount;
  }
  discount = Math.min(discount, orderSubtotal);

  res.json({ ok: true, discount: Math.round(discount * 100) / 100, coupon: { code: coupon.code, type: coupon.type, amount: coupon.amount } });
});

/* =========================================================
   ORDERS
   ========================================================= */

app.post("/api/orders", auth, (req, res) => {
  const { name, email, phone, shippingAddress, billingAddress, couponCode } = req.body;

  if (!name || !email || !shippingAddress) {
    return res.status(400).json({ error: "Name, email, and shipping address are required" });
  }

  const cart = cartFor(req);
  const items = db
    .prepare(`
      SELECT ci.quantity, p.*
      FROM cart_items ci
      JOIN products p ON p.id=ci.product_id
      WHERE ci.cart_id=?
    `)
    .all(cart.id);

  if (!items.length) return res.status(400).json({ error: "Cart is empty" });

  for (const item of items) {
    if (item.stock < item.quantity) {
      return res.status(400).json({ error: `Insufficient stock for ${item.name}` });
    }
  }

  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.sale_price ?? item.price) * item.quantity,
    0
  );

  const settings = Object.fromEntries(
    db.prepare("SELECT key, value FROM settings").all().map((r) => [r.key, r.value])
  );

  const shipping =
    subtotal >= Number(settings.free_shipping_threshold || 2000)
      ? 0
      : Number(settings.shipping_flat || 99);

  const taxRate = Number(settings.tax_rate || 0);
  const tax = (subtotal * taxRate) / 100;

  // Apply coupon if provided
  let discount = 0;
  let coupon = null;
  if (couponCode) {
    coupon = db
      .prepare("SELECT * FROM coupons WHERE code=? AND active=1")
      .get(String(couponCode).toUpperCase().trim());
    if (coupon) {
      if (!coupon.expires_at || new Date(coupon.expires_at) >= new Date()) {
        if (!coupon.usage_limit || coupon.used_count < coupon.usage_limit) {
          if (subtotal >= Number(coupon.min_order || 0)) {
            if (coupon.type === "percent") {
              discount = (subtotal * coupon.amount) / 100;
              if (coupon.max_discount) discount = Math.min(discount, coupon.max_discount);
            } else {
              discount = coupon.amount;
            }
            discount = Math.min(discount, subtotal);
          }
        }
      }
    }
  }

  const total = Math.max(0, subtotal + shipping + tax - discount);

  const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(Date.now()).slice(-5)}`;

  const transaction = db.transaction(() => {
    const result = db
      .prepare(`
        INSERT INTO orders
        (order_number, user_id, email, name, phone, shipping_address, billing_address, subtotal, discount, shipping, tax, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        orderNumber,
        req.user.id,
        String(email).toLowerCase().trim(),
        String(name).trim(),
        String(phone || "").trim(),
        String(shippingAddress).trim(),
        String(billingAddress || shippingAddress).trim(),
        subtotal,
        discount,
        shipping,
        tax,
        total
      );

    const orderId = result.lastInsertRowid;

    for (const item of items) {
      db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, sku, quantity, price)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(orderId, item.id, item.name, item.sku, item.quantity, item.sale_price ?? item.price);

      // Decrement stock
      db.prepare("UPDATE products SET stock = stock - ? WHERE id=?").run(item.quantity, item.id);
    }

    // Increment coupon usage
    if (coupon) {
      db.prepare("UPDATE coupons SET used_count = used_count + 1 WHERE id=?").run(coupon.id);
    }

    // Clear cart
    db.prepare("DELETE FROM cart_items WHERE cart_id=?").run(cart.id);

    return orderId;
  });

  try {
    const orderId = transaction();
    log(req.user.id, `Customer placed order ${orderNumber}`);
    res.json({ orderId, orderNumber, total, subtotal, shipping, tax, discount, currency: settings.currency || "INR" });
  } catch (err) {
    console.error("Order creation error:", err);
    res.status(500).json({ error: "Could not create order. Please try again." });
  }
});

app.get("/api/orders", auth, (req, res) => {
  const orders = db
    .prepare("SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC")
    .all(req.user.id);
  res.json(orders);
});

app.get("/api/orders/:id", auth, (req, res) => {
  const order = db
    .prepare("SELECT * FROM orders WHERE id=? AND user_id=?")
    .get(req.params.id, req.user.id);

  if (!order) return res.status(404).json({ error: "Order not found" });

  order.items = db
    .prepare("SELECT oi.* FROM order_items oi WHERE oi.order_id=?")
    .all(order.id);

  res.json(order);
});

/* =========================================================
   RAZORPAY — CREATE ORDER
   ========================================================= */

app.post("/api/payments/razorpay/order", auth, async (req, res) => {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: "Payment gateway not configured. Contact support." });
  }

  const { orderId } = req.body;
  if (!orderId) return res.status(400).json({ error: "orderId is required" });

  // Fetch the order to get the server-computed total
  const order = db
    .prepare("SELECT * FROM orders WHERE id=? AND user_id=?")
    .get(orderId, req.user.id);

  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.payment_status === "paid") return res.status(400).json({ error: "Order is already paid" });

  try {
    const Razorpay = require("razorpay");
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.total * 100), // server-computed amount in paise
      currency: "INR",
      receipt: String(orderId),
    });

    res.json({ ...razorpayOrder, keyId: process.env.RAZORPAY_KEY_ID });
  } catch (error) {
    console.error("Razorpay order error:", error);
    res.status(500).json({ error: "Unable to create payment order. Please try again." });
  }
});

/* =========================================================
   RAZORPAY — VERIFY PAYMENT
   ========================================================= */

app.post("/api/payments/razorpay/verify", auth, (req, res) => {
  if (!process.env.RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: "Payment gateway not configured" });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
    return res.status(400).json({ error: "Missing payment verification parameters" });
  }

  const order = db
    .prepare("SELECT * FROM orders WHERE id=? AND user_id=?")
    .get(orderId, req.user.id);

  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.payment_status === "paid") return res.json({ ok: true, message: "Order already marked paid" });

  // Verify HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    log(req.user.id, `Payment verification FAILED for order ${order.order_number}`);
    return res.status(400).json({ error: "Payment verification failed. Please contact support." });
  }

  db.prepare(`
    UPDATE orders
    SET payment_status='paid',
        order_status='Confirmed'
    WHERE id=?
  `).run(orderId);

  log(req.user.id, `Payment verified for order ${order.order_number}`);
  res.json({ ok: true, orderNumber: order.order_number });
});

/* =========================================================
   RAZORPAY — WEBHOOK
   ========================================================= */

app.post("/api/payments/razorpay/webhook", (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(200).json({ ok: true }); // ignore if not configured

  const signature = req.headers["x-razorpay-signature"];
  const body = req.body; // raw Buffer from express.raw()

  if (!signature) return res.status(400).json({ error: "Missing signature" });

  const expectedSig = crypto
    .createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");

  if (expectedSig !== signature) {
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  let event;
  try {
    event = JSON.parse(body.toString());
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  if (event.event === "payment.captured") {
    const receipt = event.payload?.payment?.entity?.order_id;
    if (receipt) {
      // receipt is the orderId we set in razorpay order creation
      db.prepare(`
        UPDATE orders
        SET payment_status='paid', order_status='Confirmed'
        WHERE id=? AND payment_status != 'paid'
      `).run(receipt);
    }
  }

  res.status(200).json({ ok: true });
});

/* =========================================================
   REVIEWS
   ========================================================= */

app.post("/api/reviews", auth, (req, res) => {
  const { productId, rating, text } = req.body;

  if (!productId || rating < 1 || rating > 5 || !text) {
    return res.status(400).json({ error: "Valid product, rating (1-5) and review text are required" });
  }

  db.prepare("INSERT INTO reviews (product_id, user_id, rating, text) VALUES (?, ?, ?, ?)").run(
    productId,
    req.user.id,
    Number(rating),
    String(text).trim()
  );

  res.json({ ok: true });
});

/* =========================================================
   ADMIN — DASHBOARD
   ========================================================= */

app.get("/api/admin/dashboard", auth, admin, (req, res) => {
  const revenue = db.prepare("SELECT COALESCE(SUM(total), 0) n FROM orders WHERE payment_status='paid'").get().n;
  const orders = db.prepare("SELECT COUNT(*) n FROM orders").get().n;
  const customers = db.prepare("SELECT COUNT(*) n FROM users WHERE role='customer'").get().n;
  const products = db.prepare("SELECT COUNT(*) n FROM products").get().n;
  const lowStock = db.prepare("SELECT COUNT(*) n FROM products WHERE stock<=5 AND status='active'").get().n;
  const recent = db.prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 8").all();

  const monthlyRevenue = db
    .prepare(`
      SELECT strftime('%Y-%m', created_at) month, COALESCE(SUM(total),0) revenue, COUNT(*) orders
      FROM orders
      WHERE payment_status='paid' AND created_at >= date('now', '-6 months')
      GROUP BY month
      ORDER BY month
    `)
    .all();

  res.json({ revenue, orders, customers, products, lowStock, recent, monthlyRevenue });
});

/* =========================================================
   ADMIN — PRODUCTS
   ========================================================= */

app.get("/api/admin/products", auth, admin, (req, res) => {
  const products = db
    .prepare(`
      SELECT p.*, c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id=p.category_id
      ORDER BY p.created_at DESC
    `)
    .all()
    .map(productRow);
  res.json(products);
});

app.post("/api/admin/products", auth, admin, upload.array("images", 10), (req, res) => {
  const body = req.body;

  if (!body.name || !body.sku || body.price === undefined) {
    return res.status(400).json({ error: "Name, SKU and price are required" });
  }

  const productSlug = `${makeSlug(body.name)}-${Date.now()}`;

  try {
    const result = db
      .prepare(`
        INSERT INTO products
        (name, slug, sku, short_description, description, price, sale_price, category_id, stock,
         material, specifications, access_methods, installation, battery, care, shipping_info, return_info,
         status, featured, bestseller, new_arrival, badge)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        body.name,
        productSlug,
        body.sku,
        body.short_description || "",
        body.description || "",
        Number(body.price),
        body.sale_price ? Number(body.sale_price) : null,
        body.category_id || null,
        Number(body.stock || 0),
        body.material || "",
        body.specifications || "",
        body.access_methods || "",
        body.installation || "",
        body.battery || "",
        body.care || "",
        body.shipping_info || "",
        body.return_info || "",
        body.status || "active",
        body.featured === "1" ? 1 : 0,
        body.bestseller === "1" ? 1 : 0,
        body.new_arrival === "1" ? 1 : 0,
        body.badge || ""
      );

    (req.files || []).forEach((file, index) => {
      db.prepare("INSERT INTO product_images (product_id, url, is_primary, sort_order) VALUES (?, ?, ?, ?)").run(
        result.lastInsertRowid,
        `/uploads/${file.filename}`,
        index === 0 ? 1 : 0,
        index
      );
    });

    log(req.user.id, `Admin added product ${body.name}`);
    res.json(productRow(db.prepare("SELECT * FROM products WHERE id=?").get(result.lastInsertRowid)));
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: error.message.includes("UNIQUE") ? "SKU already exists" : "Could not create product" });
  }
});

app.put("/api/admin/products/:id", auth, admin, upload.array("images", 10), (req, res) => {
  const body = req.body;
  const id = req.params.id;

  const old = db.prepare("SELECT * FROM products WHERE id=?").get(id);
  if (!old) return res.status(404).json({ error: "Product not found" });

  db.prepare(`
    UPDATE products SET
      name=?, short_description=?, description=?, price=?, sale_price=?,
      category_id=?, stock=?, material=?, specifications=?, access_methods=?,
      installation=?, battery=?, care=?, shipping_info=?, return_info=?,
      status=?, featured=?, bestseller=?, new_arrival=?, badge=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    body.name || old.name,
    body.short_description ?? old.short_description,
    body.description ?? old.description,
    Number(body.price ?? old.price),
    body.sale_price === "" ? null : body.sale_price !== undefined ? Number(body.sale_price) : old.sale_price,
    body.category_id || old.category_id,
    Number(body.stock ?? old.stock),
    body.material ?? old.material,
    body.specifications ?? old.specifications,
    body.access_methods ?? old.access_methods,
    body.installation ?? old.installation,
    body.battery ?? old.battery,
    body.care ?? old.care,
    body.shipping_info ?? old.shipping_info,
    body.return_info ?? old.return_info,
    body.status || old.status,
    body.featured === "1" ? 1 : body.featured === "0" ? 0 : old.featured,
    body.bestseller === "1" ? 1 : body.bestseller === "0" ? 0 : old.bestseller,
    body.new_arrival === "1" ? 1 : body.new_arrival === "0" ? 0 : old.new_arrival,
    body.badge ?? old.badge,
    id
  );

  (req.files || []).forEach((file, index) => {
    db.prepare("INSERT INTO product_images (product_id, url, is_primary, sort_order) VALUES (?, ?, 0, ?)").run(
      id,
      `/uploads/${file.filename}`,
      Date.now() + index
    );
  });

  log(req.user.id, `Admin updated product ${old.name}`);
  res.json(productRow(db.prepare("SELECT * FROM products WHERE id=?").get(id)));
});

app.delete("/api/admin/products/:id", auth, admin, (req, res) => {
  const product = db.prepare("SELECT * FROM products WHERE id=?").get(req.params.id);
  db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);
  log(req.user.id, `Admin deleted product ${product?.name || req.params.id}`);
  res.json({ ok: true });
});

app.delete("/api/admin/products/:productId/images/:imageId", auth, admin, (req, res) => {
  const image = db
    .prepare("SELECT * FROM product_images WHERE id=? AND product_id=?")
    .get(req.params.imageId, req.params.productId);

  if (!image) return res.status(404).json({ error: "Image not found" });

  // Delete file from disk
  if (image.url.startsWith("/uploads/")) {
    const filePath = path.join(uploadDir, image.url.replace("/uploads/", ""));
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }
  }

  db.prepare("DELETE FROM product_images WHERE id=?").run(req.params.imageId);
  res.json({ ok: true });
});

/* =========================================================
   ADMIN — CATEGORIES
   ========================================================= */

app.get("/api/admin/categories", auth, admin, (req, res) => {
  res.json(db.prepare("SELECT * FROM categories ORDER BY sort_order, id").all());
});

app.post("/api/admin/categories", auth, admin, (req, res) => {
  const { name, description = "", image = "", slug: customSlug } = req.body;
  if (!name) return res.status(400).json({ error: "Category name is required" });

  const result = db
    .prepare("INSERT INTO categories (name, description, image, slug) VALUES (?, ?, ?, ?)")
    .run(name, description, image, customSlug || makeSlug(name));

  res.json(db.prepare("SELECT * FROM categories WHERE id=?").get(result.lastInsertRowid));
});

app.put("/api/admin/categories/:id", auth, admin, (req, res) => {
  const { name, description, image, slug: customSlug, active, sort_order } = req.body;

  db.prepare(`
    UPDATE categories SET name=?, description=?, image=?, slug=?, active=?, sort_order=? WHERE id=?
  `).run(
    name,
    description || "",
    image || "",
    customSlug || makeSlug(name),
    active ? 1 : 0,
    Number(sort_order || 0),
    req.params.id
  );

  res.json({ ok: true });
});

app.delete("/api/admin/categories/:id", auth, admin, (req, res) => {
  db.prepare("UPDATE categories SET active=0 WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

/* =========================================================
   ADMIN — ORDERS
   ========================================================= */

app.get("/api/admin/orders", auth, admin, (req, res) => {
  const { status, search, limit = 100, offset = 0 } = req.query;
  let sql = "SELECT * FROM orders WHERE 1=1";
  const args = [];

  if (status) {
    sql += " AND order_status=?";
    args.push(status);
  }

  if (search) {
    sql += " AND (order_number LIKE ? OR name LIKE ? OR email LIKE ?)";
    const q = `%${search}%`;
    args.push(q, q, q);
  }

  sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  args.push(Number(limit), Number(offset));

  res.json(db.prepare(sql).all(...args));
});

app.get("/api/admin/orders/:id", auth, admin, (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id=?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });

  order.items = db.prepare("SELECT * FROM order_items WHERE order_id=?").all(order.id);
  res.json(order);
});

app.put("/api/admin/orders/:id", auth, admin, (req, res) => {
  const { status, tracking_number = "", carrier = "", payment_status } = req.body;

  db.prepare(`
    UPDATE orders SET order_status=?, tracking_number=?, carrier=?,
      payment_status=COALESCE(?, payment_status)
    WHERE id=?
  `).run(status, tracking_number, carrier, payment_status || null, req.params.id);

  log(req.user.id, `Admin changed order ${req.params.id} to ${status}`);
  res.json({ ok: true });
});

/* =========================================================
   ADMIN — CUSTOMERS
   ========================================================= */

app.get("/api/admin/customers", auth, admin, (req, res) => {
  const customers = db
    .prepare(`
      SELECT u.id, u.name, u.email, u.phone, u.created_at,
        COUNT(o.id) orders,
        COALESCE(SUM(o.total), 0) total_spent
      FROM users u
      LEFT JOIN orders o ON o.user_id=u.id
      WHERE u.role='customer'
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `)
    .all();
  res.json(customers);
});

/* =========================================================
   ADMIN — REVIEWS
   ========================================================= */

app.get("/api/admin/reviews", auth, admin, (req, res) => {
  res.json(
    db
      .prepare(`
        SELECT r.*, p.name product_name, u.name customer_name
        FROM reviews r
        JOIN products p ON p.id=r.product_id
        LEFT JOIN users u ON u.id=r.user_id
        ORDER BY r.created_at DESC
      `)
      .all()
  );
});

app.put("/api/admin/reviews/:id", auth, admin, (req, res) => {
  db.prepare("UPDATE reviews SET status=? WHERE id=?").run(req.body.status, req.params.id);
  res.json({ ok: true });
});

app.delete("/api/admin/reviews/:id", auth, admin, (req, res) => {
  db.prepare("DELETE FROM reviews WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

/* =========================================================
   ADMIN — COUPONS
   ========================================================= */

app.get("/api/admin/coupons", auth, admin, (req, res) => {
  res.json(db.prepare("SELECT * FROM coupons ORDER BY id DESC").all());
});

app.post("/api/admin/coupons", auth, admin, (req, res) => {
  const { code, type, amount, min_order = 0, max_discount, expires_at, usage_limit } = req.body;

  if (!code || !type || amount === undefined) {
    return res.status(400).json({ error: "Code, type, and amount are required" });
  }

  if (!["percent", "flat"].includes(type)) {
    return res.status(400).json({ error: "Type must be 'percent' or 'flat'" });
  }

  try {
    const result = db
      .prepare(`
        INSERT INTO coupons (code, type, amount, min_order, max_discount, expires_at, usage_limit)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        String(code).toUpperCase().trim(),
        type,
        Number(amount),
        Number(min_order),
        max_discount ? Number(max_discount) : null,
        expires_at || null,
        usage_limit ? Number(usage_limit) : null
      );

    log(req.user.id, `Admin created coupon ${code}`);
    res.json(db.prepare("SELECT * FROM coupons WHERE id=?").get(result.lastInsertRowid));
  } catch (err) {
    res.status(400).json({ error: "Coupon code already exists" });
  }
});

app.put("/api/admin/coupons/:id", auth, admin, (req, res) => {
  const { code, type, amount, min_order, max_discount, expires_at, usage_limit, active } = req.body;

  db.prepare(`
    UPDATE coupons SET code=?, type=?, amount=?, min_order=?, max_discount=?,
      expires_at=?, usage_limit=?, active=? WHERE id=?
  `).run(
    String(code).toUpperCase().trim(),
    type,
    Number(amount),
    Number(min_order || 0),
    max_discount ? Number(max_discount) : null,
    expires_at || null,
    usage_limit ? Number(usage_limit) : null,
    active ? 1 : 0,
    req.params.id
  );

  res.json({ ok: true });
});

app.delete("/api/admin/coupons/:id", auth, admin, (req, res) => {
  db.prepare("DELETE FROM coupons WHERE id=?").run(req.params.id);
  res.json({ ok: true });
});

/* =========================================================
   ADMIN — WEBSITE CONTENT
   ========================================================= */

app.get("/api/admin/content", auth, admin, (req, res) => {
  const rows = db.prepare("SELECT key, value FROM site_content").all();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

app.put("/api/admin/content", auth, admin, (req, res) => {
  try {
    const save = db.transaction(() => {
      for (const [key, value] of Object.entries(req.body || {})) {
        db.prepare(`
          INSERT INTO site_content (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value
        `).run(key, String(value ?? ""));
      }
    });
    save();
    log(req.user.id, "Admin updated website content");
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not save website content" });
  }
});

app.post("/api/admin/content/hero-image", auth, admin, upload.single("image"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Please select an image." });

    const imageUrl = `/uploads/${req.file.filename}`;
    db.prepare(`
      INSERT INTO site_content (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
    `).run("hero_image", imageUrl);

    log(req.user.id, `Admin uploaded homepage hero image ${req.file.filename}`);
    res.json({ ok: true, url: imageUrl, filename: req.file.filename });
  } catch (error) {
    console.error("Hero image upload error:", error);
    res.status(500).json({ error: "Could not upload hero image." });
  }
});

app.delete("/api/admin/content/hero-image", auth, admin, (req, res) => {
  try {
    const current = db.prepare("SELECT value FROM site_content WHERE key='hero_image'").get();

    if (current?.value) {
      const relativePath = current.value.replace(/^\/uploads\//, "");
      const filePath = path.join(uploadDir, relativePath);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }
    }

    db.prepare("DELETE FROM site_content WHERE key='hero_image'").run();
    log(req.user.id, "Admin removed homepage hero image");
    res.json({ ok: true });
  } catch (error) {
    console.error("Hero image delete error:", error);
    res.status(500).json({ error: "Could not remove hero image." });
  }
});

/* =========================================================
   ADMIN — IMAGE UPLOAD
   ========================================================= */

app.post("/api/admin/upload-image", auth, admin, upload.single("image"), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Please select an image." });

    const imageUrl = `/uploads/${req.file.filename}`;
    log(req.user.id, `Admin uploaded image ${req.file.filename}`);
    res.json({ ok: true, url: imageUrl, filename: req.file.filename });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not upload image." });
  }
});

/* =========================================================
   ADMIN — SETTINGS
   ========================================================= */

app.get("/api/admin/settings", auth, admin, (req, res) => {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

app.put("/api/admin/settings", auth, admin, (req, res) => {
  for (const [key, value] of Object.entries(req.body || {})) {
    db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
    `).run(key, String(value ?? ""));
  }
  log(req.user.id, "Admin updated settings");
  res.json({ ok: true });
});

/* =========================================================
   ADMIN — ACTIVITY LOG
   ========================================================= */

app.get("/api/admin/activity", auth, admin, (req, res) => {
  res.json(
    db
      .prepare(`
        SELECT a.*, u.name AS user_name
        FROM activity_log a
        LEFT JOIN users u ON u.id=a.user_id
        ORDER BY a.created_at DESC
        LIMIT 100
      `)
      .all()
  );
});

/* =========================================================
   UPLOAD ERROR HANDLER
   ========================================================= */

app.use((error, req, res, next) => {
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File too large. Maximum size is 10MB." });
  }
  if (error.message === "Only image files are allowed.") {
    return res.status(400).json({ error: error.message });
  }
  console.error("Server error:", process.env.NODE_ENV === "production" ? error.message : error);
  res.status(500).json({ error: "Internal server error" });
});

/* =========================================================
   PRODUCTION STATIC FILES
   ========================================================= */

if (process.env.NODE_ENV === "production") {
  const distDir = path.join(__dirname, "..", "dist");
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) return;
      res.sendFile(path.join(distDir, "index.html"));
    });
  }
}

/* =========================================================
   START SERVER + GRACEFUL SHUTDOWN
   ========================================================= */

const server = app.listen(PORT, () => {
  console.log(`KULUF API running at http://localhost:${PORT}`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
});

process.on("SIGINT", () => {
  console.log("SIGINT received. Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000);
});
