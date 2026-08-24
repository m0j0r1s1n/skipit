CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  email TEXT NOT NULL,
  booking_date TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  trailer TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  collection_date TEXT NOT NULL DEFAULT '',
  waste_type TEXT NOT NULL DEFAULT '',
  loading_service TEXT NOT NULL DEFAULT 'No, I''ll load it myself',
  estimated_total INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  details TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  waste_type TEXT NOT NULL DEFAULT '',
  volume TEXT NOT NULL DEFAULT '',
  urgency TEXT NOT NULL DEFAULT '',
  quote_package TEXT NOT NULL DEFAULT '',
  dropoff_date TEXT NOT NULL DEFAULT '',
  collection_date TEXT NOT NULL DEFAULT '',
  estimated_total INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);