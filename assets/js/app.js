// ─── CONFIG — update these ────────────────────────────────────────────────────
const WA_NUMBER   = "447494110411";   // Your WhatsApp number, no + or spaces
const ADMIN_PASS  = "n@3tn5Wv@x^qoj";     // Change this password before going live

const RATES = {
  "Mini Trailer":     40,
  "Standard Trailer": 60,
  "Maxi Trailer":     90
};
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", function () {

  // ── Set date minimums ────────────────────────────────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const startEl = document.getElementById("startDate");
  const endEl   = document.getElementById("endDate");
  if (startEl) { startEl.min = today; startEl.addEventListener("change", () => { if (endEl) endEl.min = startEl.value; calculatePrice(); }); }
  if (endEl)   { endEl.min = today;   endEl.addEventListener("change", calculatePrice); }
  const trailerEl = document.getElementById("trailer");
  if (trailerEl) trailerEl.addEventListener("change", calculatePrice);

  // ── Pricing card → booking scroll + pre-select ───────────────────────────
  window.chooseTrailer = function(name) {
    const sel = document.getElementById("trailer");
    if (sel) { sel.value = name; calculatePrice(); }
    const sec = document.getElementById("booking");
    if (sec) sec.scrollIntoView({ behavior: "smooth" });
  };

  // ── Tab switching ────────────────────────────────────────────────────────
  window.switchTab = function(tab, btn) {
    document.getElementById("tab-book").style.display  = tab === "book"  ? "block" : "none";
    document.getElementById("tab-quote").style.display = tab === "quote" ? "block" : "none";
    document.querySelectorAll(".ftab").forEach(b => b.classList.remove("active"));
    if (btn) btn.classList.add("active");
  };

  // ── Price calculator ─────────────────────────────────────────────────────
  window.calculatePrice = function() {
    const trailer  = document.getElementById("trailer");
    const startVal = document.getElementById("startDate")?.value;
    const endVal   = document.getElementById("endDate")?.value;
    const box      = document.getElementById("estimateBox");
    const note     = document.getElementById("estimateNote");
    const label    = document.getElementById("estimateBreak");
    const total    = document.getElementById("estimate");
    const hidden   = document.getElementById("hiddenEstimate");

    if (!startVal || !endVal || !trailer?.value) {
      if (box) box.style.display = "none";
      if (note) note.style.display = "none";
      return;
    }

    const days = Math.ceil((new Date(endVal) - new Date(startVal)) / 86400000);
    if (days < 1) {
      if (label) label.textContent = "⚠ Collection must be after drop-off";
      if (box) box.style.display = "flex";
      if (total) total.textContent = "—";
      return;
    }

    const rate  = RATES[trailer.value] || 0;
    const price = rate * days;

    if (total)  total.textContent  = "£" + price;
    if (label)  label.textContent  = trailer.value + " × " + days + (days === 1 ? " day" : " days");
    if (box)    box.style.display  = "flex";
    if (note)   note.style.display = "block";
    if (hidden) hidden.value       = "£" + price + " (" + trailer.value + " × " + days + " days)";

    // Update WhatsApp pre-fill on confirm button
    updateWALink(trailer.value, days, price,
      document.getElementById("startDate")?.value,
      document.getElementById("endDate")?.value);
  };

  // ── Build WhatsApp message ───────────────────────────────────────────────
  function updateWALink(trailer, days, price, dropoff, collect) {
    const btn = document.getElementById("waConfirmBtn");
    if (!btn) return;
    const msg = encodeURIComponent(
      "Hi SkipIt! I've just submitted a booking request:\n" +
      "• Trailer: " + trailer + "\n" +
      "• Drop-off: " + dropoff + "\n" +
      "• Collection: " + collect + "\n" +
      "• Estimated total: £" + price + "\n" +
      "Looking forward to confirming!"
    );
    btn.href = "https://wa.me/" + WA_NUMBER + "?text=" + msg;
  }

  // ── Save booking to localStorage (admin dashboard) ───────────────────────
  function saveBooking(data) {
    const key  = "skipit_bookings";
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    data.id        = "BK-" + Date.now();
    data.submitted = new Date().toLocaleString("en-GB");
    data.status    = "Pending";
    list.unshift(data);
    localStorage.setItem(key, JSON.stringify(list));
    return data.id;
  }

  function saveQuote(data) {
    const key  = "skipit_quotes";
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    data.id        = "QT-" + Date.now();
    data.submitted = new Date().toLocaleString("en-GB");
    data.status    = "Pending";
    list.unshift(data);
    localStorage.setItem(key, JSON.stringify(list));
    return data.id;
  }

  // ── Handle booking submit ────────────────────────────────────────────────
  window.handleBooking = function(e) {
    e.preventDefault();
    const btn = document.getElementById("bookBtn");
    btn.textContent = "Sending…"; btn.disabled = true;

    const trailer  = document.getElementById("trailer")?.value;
    const dropoff  = document.getElementById("startDate")?.value;
    const collect  = document.getElementById("endDate")?.value;
    const days     = Math.ceil((new Date(collect) - new Date(dropoff)) / 86400000);
    const price    = (RATES[trailer] || 0) * days;

    const booking = {
      type:      "booking",
      firstName: document.getElementById("firstName")?.value,
      lastName:  document.getElementById("lastName")?.value,
      phone:     document.getElementById("phone")?.value,
      email:     document.getElementById("email")?.value,
      trailer,
      address:   document.getElementById("address")?.value,
      waste:     document.getElementById("waste")?.value,
      dropoff,
      collect,
      days,
      estimate:  "£" + price
    };

    // Save to localStorage for admin dashboard
    const ref = saveBooking(booking);

    // Submit to Formspree (email delivery)
    const form = document.getElementById("bookingForm");
    const fd   = new FormData(form);
    fd.append("booking_ref", ref);

    fetch(form.action, { method: "POST", body: fd, headers: { Accept: "application/json" } })
      .then(() => {})
      .catch(() => {});

    // Build WhatsApp notification message
    updateWALink(trailer, days, price, dropoff, collect);

    // Show success
    setTimeout(() => {
      form.style.display = "none";
      document.getElementById("success").style.display = "block";
    }, 600);
  };

  // ── Handle quote submit ──────────────────────────────────────────────────
  window.handleQuote = function(e) {
    e.preventDefault();
    const btn = document.getElementById("quoteBtn");
    btn.textContent = "Sending…"; btn.disabled = true;

    const form = document.getElementById("quoteForm");
    const fd   = new FormData(form);

    const quote = {
      type:      "quote",
      firstName: form.querySelector("[name=first_name]")?.value,
      lastName:  form.querySelector("[name=last_name]")?.value,
      phone:     form.querySelector("[name=phone]")?.value,
      email:     form.querySelector("[name=email]")?.value,
      postcode:  form.querySelector("[name=postcode]")?.value,
      waste:     form.querySelector("[name=waste_type]")?.value,
      volume:    form.querySelector("[name=volume]")?.value,
      urgency:   form.querySelector("[name=urgency]")?.value,
      details:   form.querySelector("[name=details]")?.value
    };
    const ref = saveQuote(quote);
    fd.append("quote_ref", ref);

    fetch(form.action, { method: "POST", body: fd, headers: { Accept: "application/json" } })
      .then(() => {})
      .catch(() => {});

    setTimeout(() => {
      form.style.display = "none";
      document.getElementById("quoteSuccess").style.display = "block";
    }, 600);
  };

  // ── Admin dashboard (runs on admin.html) ─────────────────────────────────
  if (document.getElementById("admin-panel")) {
    initAdmin();
  }

  function initAdmin() {
    const loginBox   = document.getElementById("login-box");
    const dashboard  = document.getElementById("dashboard");
    const loginForm  = document.getElementById("login-form");
    const passInput  = document.getElementById("admin-pass");
    const loginError = document.getElementById("login-error");

    // Check session
    if (sessionStorage.getItem("skipit_admin") === "1") {
      showDashboard();
    }

    loginForm.addEventListener("submit", function(e) {
      e.preventDefault();
      if (passInput.value === ADMIN_PASS) {
        sessionStorage.setItem("skipit_admin", "1");
        showDashboard();
      } else {
        loginError.textContent = "Incorrect password.";
        passInput.value = "";
      }
    });

    window.adminLogout = function() {
      sessionStorage.removeItem("skipit_admin");
      loginBox.style.display  = "block";
      dashboard.style.display = "none";
    };

    window.clearData = function(type) {
      if (!confirm("Delete all " + type + "? This cannot be undone.")) return;
      localStorage.removeItem("skipit_" + type);
      renderTables();
    };

    window.updateStatus = function(type, id, status) {
      const key  = "skipit_" + type;
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      const item = list.find(x => x.id === id);
      if (item) {
        item.status = status;
        localStorage.setItem(key, JSON.stringify(list));
        renderTables();
      }
    };

    function showDashboard() {
      loginBox.style.display  = "none";
      dashboard.style.display = "block";
      renderTables();
    }

    function renderTables() {
      const bookings = JSON.parse(localStorage.getItem("skipit_bookings") || "[]");
      const quotes   = JSON.parse(localStorage.getItem("skipit_quotes")   || "[]");

      document.getElementById("booking-count").textContent = bookings.length;
      document.getElementById("quote-count").textContent   = quotes.length;
      document.getElementById("pending-count").textContent =
        [...bookings, ...quotes].filter(x => x.status === "Pending").length;

      document.getElementById("bookings-table").innerHTML = bookings.length ? `
        <table>
          <thead><tr>
            <th>Ref</th><th>Name</th><th>Phone</th><th>Trailer</th>
            <th>Drop-off</th><th>Collection</th><th>Est.</th><th>Status</th><th>Submitted</th>
          </tr></thead>
          <tbody>${bookings.map(b => `
            <tr class="status-${(b.status||'').toLowerCase().replace(' ','')}">
              <td><code>${b.id}</code></td>
              <td>${b.firstName} ${b.lastName}</td>
              <td><a href="tel:${b.phone}">${b.phone}</a></td>
              <td>${b.trailer}</td>
              <td>${b.dropoff}</td>
              <td>${b.collect}</td>
              <td><strong>${b.estimate}</strong></td>
              <td>
                <select onchange="updateStatus('bookings','${b.id}',this.value)">
                  ${["Pending","Confirmed","Collected","Cancelled"].map(s =>
                    `<option${b.status===s?" selected":""}>${s}</option>`).join("")}
                </select>
              </td>
              <td style="font-size:0.75rem;color:#888">${b.submitted}</td>
            </tr>`).join("")}
          </tbody>
        </table>` : "<p class='no-data'>No bookings yet.</p>";

      document.getElementById("quotes-table").innerHTML = quotes.length ? `
        <table>
          <thead><tr>
            <th>Ref</th><th>Name</th><th>Phone</th><th>Waste</th>
            <th>Volume</th><th>Urgency</th><th>Status</th><th>Submitted</th>
          </tr></thead>
          <tbody>${quotes.map(q => `
            <tr class="status-${(q.status||'').toLowerCase().replace(' ','')}">
              <td><code>${q.id}</code></td>
              <td>${q.firstName} ${q.lastName}</td>
              <td><a href="tel:${q.phone}">${q.phone}</a></td>
              <td>${q.waste}</td>
              <td>${q.volume||'—'}</td>
              <td>${q.urgency||'—'}</td>
              <td>
                <select onchange="updateStatus('quotes','${q.id}',this.value)">
                  ${["Pending","Quoted","Booked","Declined"].map(s =>
                    `<option${q.status===s?" selected":""}>${s}</option>`).join("")}
                </select>
              </td>
              <td style="font-size:0.75rem;color:#888">${q.submitted}</td>
            </tr>`).join("")}
          </tbody>
        </table>` : "<p class='no-data'>No quote requests yet.</p>";
    }
  }

});