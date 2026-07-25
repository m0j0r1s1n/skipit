export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Sitemap Endpoint for Search Engines (Fixed Namespace)
    if (url.pathname === "/sitemap.xml") {
      const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://skipit.work/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
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

    // 2. Password Check API
    if (url.pathname === "/api/login" && request.method === "POST") {
      try {
        const { password } = await request.json();
        if (password && password === env.ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ success: false, message: "Invalid credentials" }), {
          status: 401,
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false }), { status: 400 });
      }
    }

    // 3. Add Booking API
    if (url.pathname === "/api/bookings" && request.method === "POST") {
      try {
        const data = await request.json();
        const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim();

        await env.skipit_db.prepare(
          "INSERT INTO bookings (customer_name, email, booking_date) VALUES (?, ?, ?)"
        )
        .bind(fullName, data.email || '', data.dropoff_date || '')
        .run();

        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
      }
    }

    // 4. Add Quote Request API
    if (url.pathname === "/api/quotes" && request.method === "POST") {
      try {
        const data = await request.json();
        const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim();
        const details = `Address: ${data.address || ''} | Waste: ${data.waste_type || ''} | Vol: ${data.volume || ''} | Notes: ${data.details || ''}`;

        await env.skipit_db.prepare(
          "INSERT INTO quotes (customer_name, details) VALUES (?, ?)"
        )
        .bind(fullName, details)
        .run();

        return new Response(JSON.stringify({ success: true }), { status: 200 });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e.message }), { status: 500 });
      }
    }

    // 5. Admin Dashboard Fetch API
    if (url.pathname === "/api/admin-data" && request.method === "GET") {
      try {
        const { results: bookings } = await env.skipit_db.prepare("SELECT * FROM bookings ORDER BY id DESC").all();
        const { results: quotes } = await env.skipit_db.prepare("SELECT * FROM quotes ORDER BY id DESC").all();

        return new Response(JSON.stringify({ bookings: bookings || [], quotes: quotes || [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ bookings: [], quotes: [] }), { status: 200 });
      }
    }

    // Default static file serving (HTML, CSS, JS, Favicon)
    return env.ASSETS.fetch(request);
  }
};