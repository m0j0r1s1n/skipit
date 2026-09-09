import { HIRE_DURATIONS, PRICING, calculateConfiguredPrice, formatPrice, pricingForBookingValue } from "../../pricing-config.js";

/**
 * SkipIt Admin & Main Site Frontend Logic
 */

function renderPricingContent() {
  const cards = document.getElementById("pricingCards");
  if (!cards) return;

  const sixByFour = PRICING.trailer_6x4;
  const tenByFive = PRICING.trailer_10x5;
  const dumpRuns = PRICING.dump_runs;
  // bookingValue strings (e.g. "6' x 4' ...") contain apostrophes, so they are passed via
  // data attributes instead of inline onclick="..." to avoid breaking out of the JS string.
  cards.innerHTML = `
    <div class="card">
      <h3>${sixByFour.name}</h3>
      <p class="size">Ideal for household clear-outs and garden waste</p>
      <h4>${formatPrice(sixByFour.price_8_hours)} <span>/8 hours</span><br>${formatPrice(sixByFour.price_24_hours)} <span>/24 hours</span></h4>
      <ul><li>Drop trailer</li><li>Customer fills</li><li>Collection included</li></ul>
      <button type="button" data-booking-value="${sixByFour.bookingValue}">Book 6 × 4 Trailer</button>
    </div>
    <div class="card featured">
      <div class="tag">Twin axle trailer</div>
      <h3>${tenByFive.name}</h3>
      <p class="size">For larger loads and more demanding jobs</p>
      <h4>${formatPrice(tenByFive.price_8_hours)}</h4>
      <ul><li>Contact us for availability</li><li>Collection options discussed</li><li>Tailored quote provided</li></ul>
      <button type="button" data-booking-value="${tenByFive.bookingValue}">Request a Quote</button>
    </div>
    <div class="card">
      <h3>${dumpRuns.name}</h3>
      <p class="size">Flexible waste removal for homes and small jobs</p>
      <h4>From ${formatPrice(dumpRuns.starting_price)}</h4>
      <ul><li>Small and large clearances</li><li>Responsible disposal</li><li>Price confirmed with your details</li></ul>
      <button type="button" data-booking-value="${dumpRuns.bookingValue}">Book Dump Run</button>
    </div>`;

  cards.querySelectorAll("[data-booking-value]").forEach(button => {
    button.addEventListener("click", () => window.chooseTrailer(button.dataset.bookingValue));
  });
}

function populatePricingSelects() {
  const options = Object.values(PRICING).map(pricing => {
    let label = pricing.name;
    if (pricing.starting_price !== undefined) {
      label += ` — From ${formatPrice(pricing.starting_price)}`;
    } else if (pricing.price_8_hours === null) {
      label += ` — ${formatPrice(null)}`;
    } else {
      label += ` — ${formatPrice(pricing.price_8_hours)} / 8 hours, ${formatPrice(pricing.price_24_hours)} / 24 hours`;
    }
    return `<option value="${pricing.bookingValue}">${label}</option>`;
  }).join("");

  ["trailer", "quoteTrailer"].forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    const customGroup = select.querySelector("optgroup");
    select.innerHTML = `<option value="">Select package…</option>${options}`;
    if (customGroup && id === "trailer") select.appendChild(customGroup);
  });
}

function updateDurationOptions(selectId, trailerId, collectionId) {
  const durationSelect = document.getElementById(selectId);
  const trailer = document.getElementById(trailerId)?.value;
  const pricing = pricingForBookingValue(trailer);
  if (!durationSelect) return;

  const eightHourLabel = pricing?.price_8_hours === null || pricing?.price_8_hours === undefined
    ? "8 Hours — Contact us for a quote"
    : `8 Hours — ${formatPrice(pricing.price_8_hours)}`;
  const twentyFourHourLabel = pricing?.price_24_hours === null || pricing?.price_24_hours === undefined
    ? "24 Hours — Contact us for a quote"
    : `24 Hours — ${formatPrice(pricing.price_24_hours)}`;
  const selectedDuration = durationSelect.value;
  durationSelect.innerHTML = `
    <option value="">Select hire duration…</option>
    <option value="${HIRE_DURATIONS.EIGHT_HOURS}">${eightHourLabel}</option>
    <option value="${HIRE_DURATIONS.TWENTY_FOUR_HOURS}">${twentyFourHourLabel}</option>`;
  durationSelect.value = selectedDuration;

  const collection = document.getElementById(collectionId);
  if (collection) {
    collection.required = durationSelect.value !== HIRE_DURATIONS.EIGHT_HOURS;
  }
}

// Global UI Navigation Functions
window.switchTab = function (tab) {
  const bookTab = document.getElementById("tab-book");
  const quoteTab = document.getElementById("tab-quote");
  const tabBtns = document.querySelectorAll(".ftab");

  if (!bookTab || !quoteTab) return;

  if (tab === "book") {
    bookTab.style.display = "block";
    quoteTab.style.display = "none";
    if (tabBtns[0]) tabBtns[0].classList.add("active");
    if (tabBtns[1]) tabBtns[1].classList.remove("active");
  } else {
    bookTab.style.display = "none";
    quoteTab.style.display = "block";
    if (tabBtns[0]) tabBtns[0].classList.remove("active");
    if (tabBtns[1]) tabBtns[1].classList.add("active");
  }
};

window.requestQuote = function () {
  window.switchTab("quote");
  const bookingSec = document.getElementById("booking");
  if (bookingSec) bookingSec.scrollIntoView({ behavior: "smooth" });
};

window.chooseTrailer = function (size) {
  window.switchTab("book");
  const select = document.getElementById("trailer");
  if (select) {
    select.value = size;
    window.calculatePrice();
  }
  const bookingSec = document.getElementById("booking");
  if (bookingSec) bookingSec.scrollIntoView({ behavior: "smooth" });
};

window.calculatePrice = function () {
  const trailer = document.getElementById("trailer")?.value;
  const duration = document.getElementById("hireDuration")?.value;
  const startDate = document.getElementById("startDate")?.value;
  const endDate = document.getElementById("endDate")?.value;
  const estimateBox = document.getElementById("estimateBox");
  const estimateNote = document.getElementById("estimateNote");
  const estimateEl = document.getElementById("estimate");
  const breakEl = document.getElementById("estimateBreak");
  const hiddenEstimate = document.getElementById("hiddenEstimate");

  updateDurationOptions("hireDuration", "trailer", "endDate");

  if (!trailer || !duration || !startDate || (duration === HIRE_DURATIONS.TWENTY_FOUR_HOURS && !endDate)) {
    if (estimateBox) estimateBox.style.display = "none";
    if (estimateNote) estimateNote.style.display = "none";
    return;
  }

  let packageLabel = "";
  let dayCount = 1;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  if (!Number.isNaN(diffDays) && diffDays > 0) {
    dayCount = diffDays;
  }

  const total = calculateConfiguredPrice(trailer, duration, dayCount);
  const pricing = pricingForBookingValue(trailer);
  packageLabel = pricing ? `${pricing.name} — ${duration === HIRE_DURATIONS.EIGHT_HOURS ? "8 hours" : `${dayCount} day${dayCount > 1 ? "s" : ""}`}` : "";

  if (total === null) {
    if (estimateEl) estimateEl.textContent = "Contact us for a quote";
    if (breakEl) breakEl.textContent = packageLabel;
    if (hiddenEstimate) hiddenEstimate.value = "";
    if (estimateBox) estimateBox.style.display = "flex";
    if (estimateNote) estimateNote.style.display = "block";
    return;
  }

  if (pricing === null) {
    if (estimateBox) estimateBox.style.display = "none";
    return;
  }

  if (estimateEl) estimateEl.textContent = formatPrice(total);
  if (breakEl) breakEl.textContent = packageLabel;
  if (hiddenEstimate) hiddenEstimate.value = formatPrice(total);
  if (estimateBox) estimateBox.style.display = "flex";
  if (estimateNote) estimateNote.style.display = "block";
};

window.calculateQuoteEstimate = function () {
  const trailer = document.getElementById("quoteTrailer")?.value;
  const duration = document.getElementById("quoteHireDuration")?.value;
  const startDate = document.getElementById("quoteStartDate")?.value;
  const endDate = document.getElementById("quoteEndDate")?.value;
  const estimateBox = document.getElementById("quoteEstimateBox");
  const estimateNote = document.getElementById("quoteEstimateNote");
  const estimateEl = document.getElementById("quoteEstimate");
  const breakEl = document.getElementById("quoteEstimateBreak");
  const hiddenEstimate = document.getElementById("hiddenQuoteEstimate");

  updateDurationOptions("quoteHireDuration", "quoteTrailer", "quoteEndDate");

  if (!trailer || !duration || !startDate || (duration === HIRE_DURATIONS.TWENTY_FOUR_HOURS && !endDate)) {
    if (estimateBox) estimateBox.style.display = "none";
    if (estimateNote) estimateNote.style.display = "none";
    return;
  }

  let packageLabel = "";
  let dayCount = 1;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  if (!Number.isNaN(diffDays) && diffDays > 0) {
    dayCount = diffDays;
  }

  const total = calculateConfiguredPrice(trailer, duration, dayCount);
  const pricing = pricingForBookingValue(trailer);
  packageLabel = pricing ? `${pricing.name} — ${duration === HIRE_DURATIONS.EIGHT_HOURS ? "8 hours" : `${dayCount} day${dayCount > 1 ? "s" : ""}`}` : "";

  if (total === null) {
    if (estimateEl) estimateEl.textContent = "Contact us for a quote";
    if (breakEl) breakEl.textContent = packageLabel;
    if (hiddenEstimate) hiddenEstimate.value = "";
    if (estimateBox) estimateBox.style.display = "flex";
    if (estimateNote) estimateNote.style.display = "block";
    return;
  }

  if (pricing === null) {
    if (estimateBox) estimateBox.style.display = "none";
    return;
  }

  if (estimateEl) estimateEl.textContent = formatPrice(total);
  if (breakEl) breakEl.textContent = packageLabel;
  if (hiddenEstimate) hiddenEstimate.value = formatPrice(total);
  if (estimateBox) estimateBox.style.display = "flex";
  if (estimateNote) estimateNote.style.display = "block";
};

// Form Submissions
async function submitToPrimaryApi(url, payload, form) {
  let response;
  let result = {};

  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    try {
      result = await response.json();
    } catch {
      result = {};
    }
  } catch (error) {
    await sendFormspreeDiagnostic(form);
    throw new Error("primary_network_failure");
  }

  if (response.ok && result.success === true) return result;

  if (response.status >= 500) {
    await sendFormspreeDiagnostic(form);
  }

  throw new Error(response.status >= 500 ? "primary_server_failure" : "primary_validation_failure");
}

async function sendFormspreeDiagnostic(form) {
  try {
    const response = await fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" }
    });

    if (!response.ok) console.warn("Diagnostic form notification failed.");
  } catch {
    console.warn("Diagnostic form notification could not be sent.");
  }
}

window.handleBooking = async function (event) {
  event.preventDefault();
  const form = document.getElementById("bookingForm");
  const btn = document.getElementById("bookBtn");
  const successBox = document.getElementById("success");

  if (btn) btn.disabled = true;

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    await submitToPrimaryApi("/api/bookings", payload, form);

    if (form) form.style.display = "none";
    if (successBox) successBox.style.display = "block";
  } catch (err) {
    console.error("Booking error:", err);
    alert("We could not confirm your booking request. Please try again or contact us directly.");
  } finally {
    if (btn) btn.disabled = false;
  }
};

window.handleQuote = async function (event) {
  event.preventDefault();
  const form = document.getElementById("quoteForm");
  const btn = document.getElementById("quoteBtn");
  const successBox = document.getElementById("quoteSuccess");

  if (btn) btn.disabled = true;

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    await submitToPrimaryApi("/api/quotes", payload, form);

    if (form) form.style.display = "none";
    if (successBox) successBox.style.display = "block";
  } catch (err) {
    console.error("Quote error:", err);
    alert("We could not confirm your quote request. Please try again or contact us directly.");
  } finally {
    if (btn) btn.disabled = false;
  }
};

// Admin Dashboard & Session Handler
document.addEventListener("DOMContentLoaded", () => {
  renderPricingContent();
  populatePricingSelects();
  updateDurationOptions("hireDuration", "trailer", "endDate");
  updateDurationOptions("quoteHireDuration", "quoteTrailer", "quoteEndDate");

  const nav = document.getElementById("mainNav");
  const navToggle = document.querySelector(".nav-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (nav && navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isExpanded = nav.classList.toggle("is-open");
      navLinks.classList.toggle("is-open", isExpanded);
      navToggle.setAttribute("aria-expanded", String(isExpanded));
    });

    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("is-open");
        navLinks.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  const loginForm = document.getElementById("login-form");
  const passwordInput = document.getElementById("password-input");
  const loginError = document.getElementById("login-error");
  const adminDashboard = document.getElementById("admin-dashboard");
  const loginContainer = document.getElementById("login-container");
  const logoutBtn = document.getElementById("logout-btn");

  if (adminDashboard && loginContainer) {
    checkSessionState();
  }

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
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: enteredPassword }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          sessionStorage.setItem("skipit_admin_auth", "true");
          showDashboard();
        } else {
          showError(result.message || "Incorrect password. Access denied.");
          if (passwordInput) passwordInput.value = "";
        }
      } catch (err) {
        showError("Server error. Please check your connection and try again.");
      } finally {
        setLoadingState(false);
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("skipit_admin_auth");
      showLogin();
    });
  }

  function checkSessionState() {
    const isAuthenticated = sessionStorage.getItem("skipit_admin_auth") === "true";
    if (isAuthenticated) showDashboard();
    else showLogin();
  }

  function showDashboard() {
    if (loginContainer) loginContainer.style.display = "none";
    if (adminDashboard) adminDashboard.style.display = "block";
    if (loginError) loginError.textContent = "";
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

  async function loadDashboardData() {
    try {
      const response = await fetch("/api/admin-data");
      const data = await response.json();
      const bookings = data.bookings || [];
      const quotes = data.quotes || [];

      const bookingCountEl = document.getElementById("booking-count");
      const quoteCountEl = document.getElementById("quote-count");
      const pendingCountEl = document.getElementById("pending-count");

      if (bookingCountEl) bookingCountEl.textContent = bookings.length;
      if (quoteCountEl) quoteCountEl.textContent = quotes.length;
      if (pendingCountEl) pendingCountEl.textContent = bookings.length + quotes.length;

      renderBookingsTable(bookings);
      renderQuotesTable(quotes);
    } catch (err) {
      console.error("Error loading admin data:", err);
    }
  }

  function renderBookingsTable(bookings) {
    const tableContainer = document.getElementById("bookings-table");
    if (!tableContainer) return;

    if (bookings.length === 0) {
      tableContainer.innerHTML = "<p>No bookings found in database.</p>";
      return;
    }

    let html = `<table><thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Date</th><th>Submitted</th></tr></thead><tbody>`;
    bookings.forEach((b) => {
      html += `<tr>
        <td><code>#${b.id}</code></td>
        <td>${escapeHtml(b.customer_name || 'N/A')}</td>
        <td>${escapeHtml(b.email || 'N/A')}</td>
        <td>${escapeHtml(b.booking_date || 'N/A')}</td>
        <td>${b.created_at ? new Date(b.created_at).toLocaleString() : 'N/A'}</td>
      </tr>`;
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

    let html = `<table><thead><tr><th>ID</th><th>Name</th><th>Details</th><th>Submitted</th></tr></thead><tbody>`;
    quotes.forEach((q) => {
      html += `<tr>
        <td><code>#${q.id}</code></td>
        <td>${escapeHtml(q.customer_name || 'N/A')}</td>
        <td>${escapeHtml(q.details || 'N/A')}</td>
        <td>${q.created_at ? new Date(q.created_at).toLocaleString() : 'N/A'}</td>
      </tr>`;
    });
    html += "</tbody></table>";
    tableContainer.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
});