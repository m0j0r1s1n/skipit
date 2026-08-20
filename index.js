function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders }
  });
}

const SESSION_COOKIE = "skipit_session";
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours
const PBKDF2_ITERATIONS = 100000;

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

    if (url.pathname === "/sitemap.xml") {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://skipit.work/</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
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
        const data = await request.json();
        const fullName = `${data.first_name || ""} ${data.last_name || ""}`.trim();

        await env.skipit_db.prepare(
          "INSERT INTO bookings (customer_name, email, booking_date) VALUES (?, ?, ?)"
        ).bind(fullName, data.email || "", data.dropoff_date || "").run();

        return json({ success: true });
      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    // Public quote API
    if (url.pathname === "/api/quotes" && request.method === "POST") {
      try {
        const data = await request.json();
        const fullName = `${data.first_name || ""} ${data.last_name || ""}`.trim();
        const details =
          `Address: ${data.address || ""} | Waste: ${data.waste_type || ""} | ` +
          `Vol: ${data.volume || ""} | Notes: ${data.details || ""}`;

        await env.skipit_db.prepare(
          "INSERT INTO quotes (customer_name, details) VALUES (?, ?)"
        ).bind(fullName, details).run();

        return json({ success: true });
      } catch (e) {
        return json({ success: false, error: e.message }, 500);
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
        return json({ success: false, message: "Login failed.", error: e.message }, 500);
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