function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders }
  });
}

const SESSION_COOKIE = "skipit_session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours
const PBKDF2_ITERATIONS = 100000;
const MAX_PUBLIC_BODY_BYTES = 16 * 1024;

const BOOKING_PACKAGES = [
  "Small Load",
  "Standard Trailer Skip",
  "Heavy Waste Package",
  "Custom Trailer Package",
  "Trade Account",
  "5 Jobs Bundle",
  "10' X 5' Trailer",
  "Box Trailer Twin Axle",
  "6' x 4' Heavy Duty Trailer",
  "7' x 4' Trailer c/w Mesh Sides",
  "8' x 5' Trailer",
  "8' x 5' Tipping Trailer",
  "10' x 5' Trailer c/w Mesh Sides",
  "12' x 6'6\" Tipping Trailer",
  "12' x 6'6\" Builders Trailer",
  "14' Tri Axle Trailer",
  "16' Tri Axle Trailer",
  "Beaver Tail Trailer",
  "Double Axle Plant Trailer 2700kg",
  "Double Axle Plant Trailer 3500kg",
  "Tri Axle Plant Trailer 3500kg"
];

const QUOTE_PACKAGES = [
  "Small Load",
  "Standard Trailer Skip",
  "Heavy Waste Package",
  "Trade Account",
  "5 Jobs Bundle"
];

const BOOKING_WASTE_TYPES = [
  "Building rubble",
  "Garden waste",
  "House clearance",
  "Mixed construction waste",
  "Other"
];

const QUOTE_WASTE_TYPES = [
  "Building rubble",
  "Garden waste",
  "House clearance",
  "Mixed construction waste",
  "Mix of the above",
  "Not sure yet"
];

const QUOTE_VOLUMES = [
  "Small — a car boot's worth",
  "Medium — a van load",
  "Large — a full room clearance",
  "Very large — whole house or site",
  "Not sure"
];

const QUOTE_URGENCY = [
  "As soon as possible",
  "Within the next week",
  "Within 2–4 weeks",
  "Just planning ahead"
];

const DEFAULT_LOADING_SERVICE = "No, I'll load it myself";
const LOADING_SERVICES = [
  DEFAULT_LOADING_SERVICE,
  "Yes, I'd like SkipIt to load it"
];

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validationError(message) {
  return json({ success: false, message }, 400);
}

async function readJsonBody(request, allowedKeys) {
  if (!(request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json")) {
    throw new Error("invalid_content_type");
  }

  const contentLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_PUBLIC_BODY_BYTES) {
    throw new Error("body_too_large");
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_PUBLIC_BODY_BYTES) throw new Error("body_too_large");

  let data;
  try {
    data = JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new Error("invalid_json");
  }

  if (!data || Array.isArray(data) || typeof data !== "object") {
    throw new Error("invalid_payload");
  }

  const unexpected = Object.keys(data).filter(key => !allowedKeys.includes(key));
  if (unexpected.length > 0) throw new Error("unexpected_field");
  return data;
}

function textField(data, name, { required = false, max = 200 } = {}) {
  const value = data[name];
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error(`${name}_required`);
    return "";
  }
  if (typeof value !== "string") throw new Error(`${name}_invalid`);
  const clean = value.trim();
  if (!clean && required) throw new Error(`${name}_required`);
  if (clean.length > max) throw new Error(`${name}_too_long`);
  return clean;
}

function oneOf(value, values, { required = false } = {}) {
  if (!value) {
    if (required) throw new Error("selection_required");
    return "";
  }
  if (!values.includes(value)) throw new Error("selection_invalid");
  return value;
}

function validateEmail(value) {
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) throw new Error("email_invalid");
  return value;
}

function validatePhone(value) {
  if (value.length < 7 || value.length > 30 || !/^[0-9+()\s-]+$/.test(value)) {
    throw new Error("phone_invalid");
  }
  return value;
}

function validateDate(value, required = false) {
  if (!value) {
    if (required) throw new Error("date_required");
    return "";
  }
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) throw new Error("date_invalid");
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("date_invalid");
  }
  return value;
}

function validateDatePair(dropoffDate, collectionDate, required = false) {
  const dropoff = validateDate(dropoffDate, required);
  const collection = validateDate(collectionDate, required);
  if (Boolean(dropoff) !== Boolean(collection)) throw new Error("date_pair_required");
  if (dropoff && collection && collection < dropoff) throw new Error("date_order_invalid");
  return { dropoff, collection };
}

function calculateServerEstimate(packageName, dropoffDate, collectionDate) {
  let dayCount = 1;
  if (dropoffDate && collectionDate) {
    dayCount = Math.floor(
      (Date.parse(`${collectionDate}T00:00:00Z`) - Date.parse(`${dropoffDate}T00:00:00Z`)) /
      (24 * 60 * 60 * 1000)
    ) + 1;
  }

  if (packageName === "Small Load") return 120 + Math.max(0, dayCount - 1) * 60;
  if (packageName === "Standard Trailer Skip") return 150 + Math.max(0, dayCount - 1) * 75;
  if (packageName === "Heavy Waste Package") return 200 + Math.max(0, dayCount - 1) * 100;
  if (packageName === "Trade Account") return 350;
  if (packageName === "5 Jobs Bundle") return 750;
  return null;
}

function validateBooking(data) {
  const firstName = textField(data, "first_name", { required: true, max: 80 });
  const lastName = textField(data, "last_name", { required: true, max: 80 });
  const phone = validatePhone(textField(data, "phone", { required: true, max: 30 }));
  const email = validateEmail(textField(data, "email", { required: true, max: 254 }));
  const trailer = oneOf(textField(data, "trailer", { required: true, max: 80 }), BOOKING_PACKAGES, { required: true });
  const address = textField(data, "address", { required: true, max: 240 });
  const dates = validateDatePair(data.dropoff_date, data.collection_date, true);
  const wasteType = oneOf(textField(data, "waste_type", { max: 80 }), BOOKING_WASTE_TYPES);
  const loadingService = oneOf(textField(data, "loading_service", { max: 80 }), LOADING_SERVICES) || DEFAULT_LOADING_SERVICE;

  return {
    customerName: `${firstName} ${lastName}`,
    phone,
    email,
    trailer,
    address,
    dropoffDate: dates.dropoff,
    collectionDate: dates.collection,
    wasteType,
    loadingService,
    estimatedTotal: calculateServerEstimate(trailer, dates.dropoff, dates.collection)
  };
}

async function ensureBookingLoadingColumn(env) {
  try {
    await env.skipit_db.prepare("SELECT loading_service FROM bookings LIMIT 1").first();
  } catch {
    await env.skipit_db.prepare(
      "ALTER TABLE bookings ADD COLUMN loading_service TEXT NOT NULL DEFAULT 'No, I''ll load it myself'"
    ).run();
  }
}

function validateQuote(data) {
  const firstName = textField(data, "first_name", { required: true, max: 80 });
  const lastName = textField(data, "last_name", { required: true, max: 80 });
  const phone = validatePhone(textField(data, "phone", { required: true, max: 30 }));
  const email = validateEmail(textField(data, "email", { required: true, max: 254 }));
  const address = textField(data, "address", { required: true, max: 240 });
  const wasteType = oneOf(textField(data, "waste_type", { required: true, max: 80 }), QUOTE_WASTE_TYPES, { required: true });
  const volume = oneOf(textField(data, "volume", { max: 100 }), QUOTE_VOLUMES);
  const urgency = oneOf(textField(data, "urgency", { max: 80 }), QUOTE_URGENCY);
  const packageName = oneOf(textField(data, "quote_package", { required: true, max: 80 }), QUOTE_PACKAGES, { required: true });
  const dates = validateDatePair(data.dropoff_date, data.collection_date);
  const details = textField(data, "details", { max: 2000 });

  return {
    customerName: `${firstName} ${lastName}`,
    phone,
    email,
    address,
    wasteType,
    volume,
    urgency,
    packageName,
    dropoffDate: dates.dropoff,
    collectionDate: dates.collection,
    estimatedTotal: calculateServerEstimate(packageName, dates.dropoff, dates.collection),
    details
  };
}

function base64urlEncode(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function textToBytes(text) {
  return new TextEncoder().encode(text);
}

function bytesToText(bytes) {
  return new TextDecoder().decode(bytes);
}

async function hmacSign(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    textToBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, textToBytes(value)));
}

async function createSession(username, role, secret) {
  const payload = {
    u: username,
    r: role,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE
  };

  const encodedPayload = base64urlEncode(textToBytes(JSON.stringify(payload)));
  const signature = base64urlEncode(await hmacSign(secret, encodedPayload));
  return `${encodedPayload}.${signature}`;
}

async function readSession(request, secret) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;

  const token = decodeURIComponent(match[1]);
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadPart, signaturePart] = parts;
  const expected = await hmacSign(secret, payloadPart);
  const supplied = base64urlDecode(signaturePart);

  if (expected.length !== supplied.length) return null;

  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ supplied[i];
  if (diff !== 0) return null;

  try {
    const payload = JSON.parse(bytesToText(base64urlDecode(payloadPart)));
    if (!payload.u || !payload.r || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_MAX_AGE}; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const baseKey = await crypto.subtle.importKey(
    "raw",
    textToBytes(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256"
    },
    baseKey,
    256
  );

  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${base64urlEncode(salt)}$${base64urlEncode(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;

  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 100000) return false;

  let salt;
  let expected;
  try {
    salt = base64urlDecode(parts[2]);
    expected = base64urlDecode(parts[3]);
  } catch {
    return false;
  }

  const baseKey = await crypto.subtle.importKey(
    "raw",
    textToBytes(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256"
    },
    baseKey,
    expected.length * 8
  );

  const actual = new Uint8Array(bits);
  if (actual.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

async function requireAuth(request, env, requiredRole = null) {
  if (!env.SESSION_SECRET) {
    return { error: json({ success: false, error: "SESSION_SECRET is not configured." }, 500) };
  }

  const session = await readSession(request, env.SESSION_SECRET);
  if (!session) {
    return { error: json({ success: false, message: "Authentication required." }, 401) };
  }

  if (requiredRole === "admin" && session.r !== "admin") {
    return { error: json({ success: false, message: "Admin access required." }, 403) };
  }

  return { session };
}

async function bootstrapAdmin(env) {
  const countRow = await env.skipit_db.prepare(
    "SELECT COUNT(*) AS count FROM users"
  ).first();

  if (Number(countRow?.count || 0) > 0) return;

  // One-time migration from the old ADMIN_PASSWORD system.
  // Set ADMIN_PASSWORD before the first login.
  if (!env.ADMIN_PASSWORD) {
    throw new Error("No users exist and ADMIN_PASSWORD is not configured.");
  }

  const username = env.ADMIN_USERNAME || "admin";
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);

  await env.skipit_db.prepare(
    "INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')"
  ).bind(username, passwordHash).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.protocol === "http:") {
      const httpsUrl = new URL(request.url);
      httpsUrl.protocol = "https:";
      return Response.redirect(httpsUrl.toString(), 301);
    }

    if (url.pathname === "/services.html") {
      return Response.redirect(new URL("/services", url).toString(), 301);
    }

    if (url.pathname === "/sitemap.xml") {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://skipit.work/</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://skipit.work/services</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;

      return new Response(xmlContent, {
        headers: {
          "Content-Type": "application/xml",
          "Cache-Control": "max-age=3600"
        }
      });
    }

    // Public booking API
    if (url.pathname === "/api/bookings" && request.method === "POST") {
      try {
        const data = await readJsonBody(request, [
          "_subject", "form_type", "first_name", "last_name", "phone", "email",
          "trailer", "address", "dropoff_date", "collection_date", "waste_type", "loading_service", "estimated_total"
        ]);
        const booking = validateBooking(data);

        await ensureBookingLoadingColumn(env);

        await env.skipit_db.prepare(
          "INSERT INTO bookings (customer_name, email, booking_date, phone, trailer, address, collection_date, waste_type, loading_service, estimated_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          booking.customerName,
          booking.email,
          booking.dropoffDate,
          booking.phone,
          booking.trailer,
          booking.address,
          booking.collectionDate,
          booking.wasteType,
          booking.loadingService,
          booking.estimatedTotal
        ).run();

        return json({ success: true });
      } catch (e) {
        if (["invalid_content_type", "body_too_large", "invalid_json", "invalid_payload", "unexpected_field"].includes(e.message)) {
          return validationError("Please submit a valid booking request.");
        }
        if (e.message.endsWith("_required") || e.message.endsWith("_invalid") || e.message.endsWith("_too_long") || e.message === "date_order_invalid" || e.message === "date_pair_required") {
          return validationError("Please check the booking details and try again.");
        }
        return json({ success: false, message: "We could not save your booking request. Please try again." }, 500);
      }
    }

    // Public quote API
    if (url.pathname === "/api/quotes" && request.method === "POST") {
      try {
        const data = await readJsonBody(request, [
          "_subject", "form_type", "first_name", "last_name", "phone", "email", "address",
          "waste_type", "volume", "urgency", "quote_package", "dropoff_date", "collection_date",
          "estimated_total", "details"
        ]);
        const quote = validateQuote(data);

        await env.skipit_db.prepare(
          "INSERT INTO quotes (customer_name, details, email, phone, address, waste_type, volume, urgency, quote_package, dropoff_date, collection_date, estimated_total) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          quote.customerName,
          quote.details,
          quote.email,
          quote.phone,
          quote.address,
          quote.wasteType,
          quote.volume,
          quote.urgency,
          quote.packageName,
          quote.dropoffDate,
          quote.collectionDate,
          quote.estimatedTotal
        ).run();

        return json({ success: true });
      } catch (e) {
        if (["invalid_content_type", "body_too_large", "invalid_json", "invalid_payload", "unexpected_field"].includes(e.message)) {
          return validationError("Please submit a valid quote request.");
        }
        if (e.message.endsWith("_required") || e.message.endsWith("_invalid") || e.message.endsWith("_too_long") || e.message === "date_order_invalid" || e.message === "date_pair_required") {
          return validationError("Please check the quote details and try again.");
        }
        return json({ success: false, message: "We could not save your quote request. Please try again." }, 500);
      }
    }

    // Login
    if (url.pathname === "/api/login" && request.method === "POST") {
      try {
        await bootstrapAdmin(env);

        const { username, password } = await request.json();
        if (!username || !password) {
          return json({ success: false, message: "Username and password are required." }, 400);
        }

        const user = await env.skipit_db.prepare(
          "SELECT username, password_hash, role FROM users WHERE username = ? LIMIT 1"
        ).bind(String(username).trim()).first();

        if (!user || !(await verifyPassword(password, user.password_hash))) {
          return json({ success: false, message: "Invalid username or password." }, 401);
        }

        const token = await createSession(user.username, user.role, env.SESSION_SECRET);

        return json(
          { success: true, user: { username: user.username, role: user.role } },
          200,
          { "Set-Cookie": sessionCookie(token) }
        );
      } catch (e) {
        return json({ success: false, message: "Login failed." }, 500);
      }
    }

    // Logout
    if (url.pathname === "/api/logout" && request.method === "POST") {
      return json({ success: true }, 200, { "Set-Cookie": clearSessionCookie() });
    }

    // Current user/session
    if (url.pathname === "/api/me" && request.method === "GET") {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;

      return json({
        success: true,
        user: { username: auth.session.u, role: auth.session.r }
      });
    }

    // Protected dashboard data: admin + staff
    if (url.pathname === "/api/admin-data" && request.method === "GET") {
      const auth = await requireAuth(request, env);
      if (auth.error) return auth.error;

      try {
        const { results: bookings } = await env.skipit_db.prepare(
          "SELECT * FROM bookings ORDER BY id DESC"
        ).all();
        const { results: quotes } = await env.skipit_db.prepare(
          "SELECT * FROM quotes ORDER BY id DESC"
        ).all();

        return json({ bookings: bookings || [], quotes: quotes || [] });
      } catch (e) {
        return json({ bookings: [], quotes: [] }, 500);
      }
    }

    // Admin: list users
    if (url.pathname === "/api/admin/users" && request.method === "GET") {
      const auth = await requireAuth(request, env, "admin");
      if (auth.error) return auth.error;

      const { results } = await env.skipit_db.prepare(
        "SELECT id, username, role, created_at FROM users ORDER BY username"
      ).all();

      return json({ users: results || [] });
    }

    // Admin: create user
    if (url.pathname === "/api/admin/users" && request.method === "POST") {
      const auth = await requireAuth(request, env, "admin");
      if (auth.error) return auth.error;

      try {
        const { username, password, role } = await request.json();
        const cleanUsername = String(username || "").trim();
        const cleanRole = role === "staff" ? "staff" : "admin";

        if (!/^[A-Za-z0-9._-]{3,40}$/.test(cleanUsername)) {
          return json({ success: false, message: "Username must be 3-40 characters and use letters, numbers, ., _, or -." }, 400);
        }

        if (typeof password !== "string" || password.length < 12) {
          return json({ success: false, message: "Password must be at least 12 characters." }, 400);
        }

        const passwordHash = await hashPassword(password);

        await env.skipit_db.prepare(
          "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)"
        ).bind(cleanUsername, passwordHash, cleanRole).run();

        return json({ success: true });
      } catch (e) {
        const message = String(e.message || "");
        if (message.toLowerCase().includes("unique")) {
          return json({ success: false, message: "That username already exists." }, 409);
        }
        return json({ success: false, message: "Could not create user." }, 500);
      }
    }

    // Admin: update role/password
    if (url.pathname === "/api/admin/users" && request.method === "PATCH") {
      const auth = await requireAuth(request, env, "admin");
      if (auth.error) return auth.error;

      try {
        const { id, role, password } = await request.json();
        if (!id) return json({ success: false, message: "User ID is required." }, 400);

        const target = await env.skipit_db.prepare(
          "SELECT id, username, role FROM users WHERE id = ?"
        ).bind(id).first();

        if (!target) return json({ success: false, message: "User not found." }, 404);

        if (target.username === auth.session.u && role === "staff") {
          return json({ success: false, message: "You cannot remove your own admin access." }, 400);
        }

        if (role === "admin" || role === "staff") {
          await env.skipit_db.prepare(
            "UPDATE users SET role = ? WHERE id = ?"
          ).bind(role, id).run();
        }

        if (typeof password === "string" && password.length > 0) {
          if (password.length < 12) {
            return json({ success: false, message: "Password must be at least 12 characters." }, 400);
          }

          const passwordHash = await hashPassword(password);
          await env.skipit_db.prepare(
            "UPDATE users SET password_hash = ? WHERE id = ?"
          ).bind(passwordHash, id).run();
        }

        return json({ success: true });
      } catch (e) {
        return json({ success: false, message: "Could not update user." }, 500);
      }
    }

    // Admin: delete user
    if (url.pathname === "/api/admin/users" && request.method === "DELETE") {
      const auth = await requireAuth(request, env, "admin");
      if (auth.error) return auth.error;

      try {
        const { id } = await request.json();
        const target = await env.skipit_db.prepare(
          "SELECT id, username FROM users WHERE id = ?"
        ).bind(id).first();

        if (!target) return json({ success: false, message: "User not found." }, 404);
        if (target.username === auth.session.u) {
          return json({ success: false, message: "You cannot delete your own account." }, 400);
        }

        await env.skipit_db.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
        return json({ success: true });
      } catch {
        return json({ success: false, message: "Could not delete user." }, 500);
      }
    }

    // Admin-only deletion of bookings/quotes
    if (url.pathname === "/api/admin-data" && request.method === "DELETE") {
      const auth = await requireAuth(request, env, "admin");
      if (auth.error) return auth.error;

      try {
        const { type } = await request.json();
        if (type === "bookings") {
          await env.skipit_db.prepare("DELETE FROM bookings").run();
        } else if (type === "quotes") {
          await env.skipit_db.prepare("DELETE FROM quotes").run();
        } else {
          return json({ success: false, message: "Invalid data type." }, 400);
        }

        return json({ success: true });
      } catch {
        return json({ success: false, message: "Could not clear data." }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};