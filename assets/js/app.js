/**
 * SkipIt Admin & Application Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  // DOM Element References
  const loginForm = document.getElementById("login-form");
  const passwordInput = document.getElementById("password-input");
  const loginError = document.getElementById("login-error");
  const adminDashboard = document.getElementById("admin-dashboard");
  const loginContainer = document.getElementById("login-container");
  const logoutBtn = document.getElementById("logout-btn");

  // Initialize session state check on load
  if (adminDashboard && loginContainer) {
    checkSessionState();
  }

  // Handle Admin Login Form Submission
  if (loginForm) {
    loginForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const enteredPassword = passwordInput ? passwordInput.value.trim() : "";

      if (!enteredPassword) {
        showError("Please enter a password.");
        return;
      }

      setLoadingState(true);

      try {
        // Send authentication request to Cloudflare Worker endpoint
        const response = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: enteredPassword }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Store authentication session flag
          sessionStorage.setItem("skipit_admin_auth", "true");
          showDashboard();
        } else {
          showError(result.message || "Incorrect password. Access denied.");
          if (passwordInput) passwordInput.value = "";
        }
      } catch (err) {
        console.error("Login request error:", err);
        showError("Server error. Please check your connection and try again.");
      } finally {
        setLoadingState(false);
      }
    });
  }

  // Handle Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("skipit_admin_auth");
      showLogin();
    });
  }

  // --- Session & Navigation Handlers ---

  function checkSessionState() {
    const isAuthenticated = sessionStorage.getItem("skipit_admin_auth") === "true";
    if (isAuthenticated) {
      showDashboard();
    } else {
      showLogin();
    }
  }

  function showDashboard() {
    if (loginContainer) loginContainer.style.display = "none";
    if (adminDashboard) adminDashboard.style.display = "block";
    if (loginError) loginError.textContent = "";

    // Fetch and display live database records upon viewing dashboard
    loadDashboardData();
  }

  function showLogin() {
    if (loginContainer) loginContainer.style.display = "block";
    if (adminDashboard) adminDashboard.style.display = "none";
  }

  function showError(msg) {
    if (loginError) {
      loginError.textContent = msg;
      loginError.style.color = "#d9534f";
    }
  }

  function setLoadingState(isLoading) {
    const submitBtn = loginForm ? loginForm.querySelector('button[type="submit"]') : null;
    if (submitBtn) {
      submitBtn.disabled = isLoading;
      submitBtn.textContent = isLoading ? "Verifying..." : "Log In";
    }
  }

  // --- Persistent Database Data Loading ---

  async function loadDashboardData() {
    try {
      const response = await fetch("/api/admin-data");
      
      if (!response.ok) {
        throw new Error("Failed to load dashboard data");
      }

      const data = await response.json();
      const bookings = data.bookings || [];
      const quotes = data.quotes || [];

      // Update stat cards
      const bookingCountEl = document.getElementById("booking-count");
      const quoteCountEl = document.getElementById("quote-count");
      const pendingCountEl = document.getElementById("pending-count");

      if (bookingCountEl) bookingCountEl.textContent = bookings.length;
      if (quoteCountEl) quoteCountEl.textContent = quotes.length;
      if (pendingCountEl) pendingCountEl.textContent = bookings.length + quotes.length;

      // Render Bookings Table
      renderBookingsTable(bookings);

      // Render Quotes Table
      renderQuotesTable(quotes);

    } catch (err) {
      console.error("Error loading persistent dashboard data:", err);
    }
  }

  function renderBookingsTable(bookings) {
    const tableContainer = document.getElementById("bookings-table");
    if (!tableContainer) return;

    if (bookings.length === 0) {
      tableContainer.innerHTML = "<p>No bookings found in database.</p>";
      return;
    }

    let html = `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Booking Date</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
    `;

    bookings.forEach((b) => {
      html += `
        <tr>
          <td><code>#${b.id}</code></td>
          <td>${escapeHtml(b.customer_name || 'N/A')}</td>
          <td>${escapeHtml(b.email || 'N/A')}</td>
          <td>${escapeHtml(b.booking_date || 'N/A')}</td>
          <td>${b.created_at ? new Date(b.created_at).toLocaleString() : 'N/A'}</td>
        </tr>
      `;
    });

    html += "</tbody></table>";
    tableContainer.innerHTML = html;
  }

  function renderQuotesTable(quotes) {
    const tableContainer = document.getElementById("quotes-table");
    if (!tableContainer) return;

    if (quotes.length === 0) {
      tableContainer.innerHTML = "<p>No quote requests found in database.</p>";
      return;
    }

    let html = `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Details</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
    `;

    quotes.forEach((q) => {
      html += `
        <tr>
          <td><code>#${q.id}</code></td>
          <td>${escapeHtml(q.customer_name || 'N/A')}</td>
          <td>${escapeHtml(q.details || 'N/A')}</td>
          <td>${q.created_at ? new Date(q.created_at).toLocaleString() : 'N/A'}</td>
        </tr>
      `;
    });

    html += "</tbody></table>";
    tableContainer.innerHTML = html;
  }

  // Security helper to prevent XSS output rendering
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
});