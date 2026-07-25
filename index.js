export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle password check via API
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

    // Default behavior: serve standard static files (HTML, JS, CSS)
    return env.ASSETS.fetch(request);
  }
};