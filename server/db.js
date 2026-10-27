const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "data");
fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(path.join(dataDir, "kuluf.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 email TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'customer',
 phone TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS categories (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 description TEXT DEFAULT '',
 image TEXT DEFAULT '',
 slug TEXT UNIQUE NOT NULL,
 active INTEGER NOT NULL DEFAULT 1,
 sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 slug TEXT UNIQUE NOT NULL,
 sku TEXT UNIQUE NOT NULL,
 short_description TEXT DEFAULT '',
 description TEXT DEFAULT '',
 price REAL NOT NULL DEFAULT 0,
 sale_price REAL,
 category_id INTEGER,
 stock INTEGER NOT NULL DEFAULT 0,
 material TEXT DEFAULT '',
 specifications TEXT DEFAULT '',
 access_methods TEXT DEFAULT '',
 installation TEXT DEFAULT '',
 battery TEXT DEFAULT '',
 care TEXT DEFAULT '',
 shipping_info TEXT DEFAULT '',
 return_info TEXT DEFAULT '',
 status TEXT NOT NULL DEFAULT 'active',
 featured INTEGER NOT NULL DEFAULT 0,
 bestseller INTEGER NOT NULL DEFAULT 0,
 new_arrival INTEGER NOT NULL DEFAULT 0,
 badge TEXT DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS product_images (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 product_id INTEGER NOT NULL,
 url TEXT NOT NULL,
 is_primary INTEGER NOT NULL DEFAULT 0,
 sort_order INTEGER NOT NULL DEFAULT 0,
 FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS carts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER,
 session_id TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS cart_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 cart_id INTEGER NOT NULL,
 product_id INTEGER NOT NULL,
 quantity INTEGER NOT NULL DEFAULT 1,
 UNIQUE(cart_id, product_id),
 FOREIGN KEY(cart_id) REFERENCES carts(id) ON DELETE CASCADE,
 FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_number TEXT UNIQUE NOT NULL,
 user_id INTEGER,
 email TEXT NOT NULL,
 name TEXT NOT NULL,
 phone TEXT DEFAULT '',
 shipping_address TEXT NOT NULL,
 billing_address TEXT NOT NULL,
 subtotal REAL NOT NULL,
 discount REAL NOT NULL DEFAULT 0,
 shipping REAL NOT NULL DEFAULT 0,
 tax REAL NOT NULL DEFAULT 0,
 total REAL NOT NULL,
 payment_status TEXT NOT NULL DEFAULT 'pending',
 order_status TEXT NOT NULL DEFAULT 'Pending Payment',
 tracking_number TEXT DEFAULT '',
 carrier TEXT DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS order_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id INTEGER NOT NULL,
 product_id INTEGER,
 product_name TEXT NOT NULL,
 sku TEXT DEFAULT '',
 quantity INTEGER NOT NULL,
 price REAL NOT NULL,
 FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
 FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS reviews (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 product_id INTEGER NOT NULL,
 user_id INTEGER,
 rating INTEGER NOT NULL,
 text TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS coupons (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 code TEXT UNIQUE NOT NULL,
 type TEXT NOT NULL,
 amount REAL NOT NULL,
 min_order REAL NOT NULL DEFAULT 0,
 max_discount REAL,
 expires_at TEXT,
 usage_limit INTEGER,
 used_count INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS site_content (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activity_log (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER,
 action TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS password_resets (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 token TEXT UNIQUE NOT NULL,
 expires_at TEXT NOT NULL,
 used INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS email_verifications (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER NOT NULL,
 token TEXT UNIQUE NOT NULL,
 expires_at TEXT NOT NULL,
 verified_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

const adminEmail = process.env.ADMIN_EMAIL || "admin@kuluf.com";
const adminPassword = process.env.ADMIN_PASSWORD || "ChangeThisPassword123!";
const existing = db.prepare("SELECT id FROM users WHERE email=?").get(adminEmail);
if (!existing) {
  const hash = bcrypt.hashSync(adminPassword, 12);
  db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')")
    .run("KULUF Admin", adminEmail, hash);
}

const catCount = db.prepare("SELECT COUNT(*) c FROM categories").get().c;
if (!catCount) {
  const cats = [
    ["Home Locks","Smart locks for homes","/uploads/category-home.svg","home-locks"],
    ["Office Locks","Modern access for workplaces","/uploads/category-office.svg","office-locks"],
    ["Commercial Locks","Heavy-duty commercial security","/uploads/category-commercial.svg","commercial-locks"],
    ["Access Control Systems","Complete entry management","/uploads/category-access.svg","access-control-systems"],
    ["Digital Locks","Connected digital locking solutions","/uploads/category-digital.svg","digital-locks"],
    ["Smart Door Locks","Premium connected door locks","/uploads/category-smart.svg","smart-door-locks"]
  ];
  const stmt = db.prepare("INSERT INTO categories(name,description,image,slug) VALUES(?,?,?,?)");
  const tx = db.transaction(rows => rows.forEach(r => stmt.run(...r)));
  tx(cats);
}

const contentDefaults = {
  hero_title: "SECURITY\\nSTARTS AT\\nYOUR DOOR.",
  hero_description: "Smart security locks designed to keep your home, business and loved ones safe.",
  hero_image: "/uploads/hero-lock.svg",
  about_title: "BUILDING\\nA SAFER\\nTOMORROW.",
  about_story: "At KULUF, we believe security is more than a lock. It is peace of mind, confidence and the freedom to focus on what matters most.",
  mission: "SMART SOLUTIONS\\nFOR A SAFER WORLD.",
  vision: "SAFER SPACES.\\nBRIGHTER TOMORROWS.",
  cta_title: "READY TO UPGRADE\\nYOUR SECURITY?"
};
for (const [k,v] of Object.entries(contentDefaults)) {
  db.prepare("INSERT OR IGNORE INTO site_content(key,value) VALUES(?,?)").run(k,v);
}
for (const [k,v] of Object.entries({
  store_name:"KULUF Total Security", currency:"INR", tax_rate:"18", shipping_flat:"99",
  free_shipping_threshold:"2000", support_email:"support@kuluf.com", support_phone:"+91 00000 00000"
})) db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)").run(k,v);

// Safe column migrations — ALTER TABLE is idempotent via try/catch
(function applyMigrations() {
  const migrations = [
    "ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN oauth_provider TEXT DEFAULT ''",
    "ALTER TABLE users ADD COLUMN oauth_id TEXT DEFAULT ''",
  ];
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }
})();

module.exports = db;
