export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Password Check API
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

    // 2. Add Booking API
    if (url.pathname === "/api/bookings" && request.method === "POST") {
      const { name, email, date } = await request.json();
      await env.DB.prepare("INSERT INTO bookings (customer_name, email, booking_date) VALUES (?, ?, ?)")
        .bind(name, email, date)
        .run();
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    // 3. Get All Data API for Admin Dashboard
    if (url.pathname === "/api/admin-data" && request.method === "GET") {
      const { results: bookings } = await env.DB.prepare("SELECT * FROM bookings ORDER BY id DESC").all();
      const { results: quotes } = await env.DB.prepare("SELECT * FROM quotes ORDER BY id DESC").all();

      return new Response(JSON.stringify({ bookings, quotes }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Default static file serving
    return env.ASSETS.fetch(request);
  }
};