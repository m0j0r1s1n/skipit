// ─── CONFIG — update these ────────────────────────────────────────────────────
const WA_NUMBER   = "447494110411";   // Your WhatsApp number, no + or spaces
const ADMIN_PASS  = "n@3tn5Wv@x^qoj"; // Change this password before going live

const RATES = {
  "Mini Trailer":     140,
  "Standard Trailer": 220,
  "Maxi Trailer":     310
};

// ── 1. GLOBAL TAB SWITCHING (Called by HTML buttons) ──────────────────────────
window.switchTab = function(tabName) {
  const bookTab  = document.getElementById("tab-book");
  const quoteTab = document.getElementById("tab-quote");
  const tabs     = document.querySelectorAll(".ftab");

  if (tabName === "book") {
    if (bookTab)  bookTab.style.display  = "block";
    if (quoteTab) quoteTab.style.display = "none";
    if (tabs[0]) tabs[0].classList.add("active");
    if (tabs[1]) tabs[1].classList.remove("active");
  } else if (tabName === "quote") {
    if (bookTab)  bookTab.style.display  = "none";
    if (quoteTab) quoteTab.style.display = "block";
    if (tabs[1]) tabs[1].classList.add("active");
    if (tabs[0]) tabs[0].classList.remove("active");
  }
};

window.requestQuote = function(wasteType) {
  window.switchTab("quote");

  if (wasteType) {
    const select = document.querySelector("#quoteForm select[name=waste_type]");
    if (select) select.value = wasteType;
  }

  const sec = document.getElementById("booking");
  if (sec) sec.scrollIntoView({ behavior: "smooth" });
};

window.chooseTrailer = function(name) {
  window.switchTab("book");
  const sel = document.getElementById("trailer");
  if (sel) { sel.value = name; calculatePrice(); }
  const sec = document.getElementById("booking");
  if (sec) sec.scrollIntoView({ behavior: "smooth" });
};

// ── 2. PRICE CALCULATOR ───────────────────────────────────────────────────────
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

  updateWALink(trailer.value, days, price, startVal, endVal);
};

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

// ── 3. FORM SUBMISSION HANDLERS ───────────────────────────────────────────────
window.handleBooking = function(e) {
  e.preventDefault();
  const btn = document.getElementById("bookBtn");
  if (btn) { btn.textContent = "Sending…"; btn.disabled = true; }

  const trailer  = document.getElementById("trailer")?.value;
  const dropoff  = document.getElementById("startDate")?.value;
  const collect  = document.getElementById("endDate")?.value;
  const days     = Math.ceil((new Date(collect) - new Date(dropoff)) / 86400000);
  const price    = (RATES[trailer] || 0) * (days > 0 ? days : 1);

  const booking = {
    type:      "booking",
    firstName: document.getElementById("firstName")?.value,
    lastName:  document.getElementById("lastName")?.value,
    phone:     document.getElementById("phone")?.value,
    email:     document.getElementById("email")?.value,
    address:   document.getElementById("address")?.value,
    trailer,
    waste:     document.getElementById("waste")?.value,
    dropoff,
    collect,
    days,
    estimate:  "£" + price
  };

  saveData("skipit_bookings", booking, "BK");

  const form = document.getElementById("bookingForm");
  const fd   = new FormData(form);

  fetch(form.action, { method: "POST", body: fd, headers: { Accept: "application/json" } })
    .then(() => {})
    .catch(() => {});

  setTimeout(() => {
    form.style.display = "none";
    document.getElementById("success").style.display = "block";
  }, 600);
};

window.handleQuote = function(e) {
  e.preventDefault();
  const btn = document.getElementById("quoteBtn");
  if (btn) { btn.textContent = "Sending…"; btn.disabled = true; }

  const form = document.getElementById("quoteForm");
  const fd   = new FormData(form);

  const quote = {
    type:      "quote",
    firstName: form.querySelector("[name=first_name]")?.value,
    lastName:  form.querySelector("[name=last_name]")?.value,
    phone:     form.querySelector("[name=phone]")?.value,
    email:     form.querySelector("[name=email]")?.value,
    address:   form.querySelector("[name=address]")?.value || form.querySelector("[name=postcode]")?.value,
    waste:     form.querySelector("[name=waste_type]")?.value,
    volume:    form.querySelector("[name=volume]")?.value,
    urgency:   form.querySelector("[name=urgency]")?.value,
    details:   form.querySelector("[name=details]")?.value
  };

  saveData("skipit_quotes", quote, "QT");

  fetch(form.action, { method: "POST", body: fd, headers: { Accept: "application/json" } })
    .then(() => {})
    .catch(() => {});

  setTimeout(() => {
    form.style.display = "none";
    document.getElementById("quoteSuccess").style.display = "block";
  }, 600);
};

function saveData(key, data, prefix) {
  const list = JSON.parse(localStorage.getItem(key) || "[]");
  data.id        = prefix + "-" + Date.now();
  data.submitted = new Date().toLocaleString("en-GB");
  data.status    = "Pending";
  list.unshift(data);
  localStorage.setItem(key, JSON.stringify(list));
}

// ── 4. INITIALIZE PAGE & ADMIN ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  const today = new Date().toISOString().split("T")[0];
  const startEl = document.getElementById("startDate");
  const endEl   = document.getElementById("endDate");
  if (startEl) {
    startEl.min = today;
    startEl.addEventListener("change", () => {
      if (endEl) endEl.min = startEl.value;
      calculatePrice();
    });
  }
  if (endEl) {
    endEl.min = today;
    endEl.addEventListener("change", calculatePrice);
  }

  // Admin page handler
  if (document.getElementById("admin-panel")) {
    initAdmin();
  }
});

function initAdmin() {
  const loginBox   = document.getElementById("login-box");
  const dashboard  = document.getElementById("dashboard");
  const loginForm  = document.getElementById("login-form");
  const passInput  = document.getElementById("admin-pass");
  const loginError = document.getElementById("login-error");

  if (sessionStorage.getItem("skipit_admin") === "1") {
    showDashboard();
  }

  if (loginForm) {
    loginForm.addEventListener("submit", function(e) {
      e.preventDefault();
      if (passInput.value === ADMIN_PASS) {
        sessionStorage.setItem("skipit_admin", "1");
        showDashboard();
      } else {
        if (loginError) loginError.textContent = "Incorrect password.";
        passInput.value = "";
      }
    });
  }

  window.adminLogout = function() {
    sessionStorage.removeItem("skipit_admin");
    if (loginBox) loginBox.style.display = "block";
    if (dashboard) dashboard.style.display = "none";
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
    if (loginBox)  loginBox.style.display  = "none";
    if (dashboard) dashboard.style.display = "block";
    renderTables();
  }

  function renderTables() {
    const bookings = JSON.parse(localStorage.getItem("skipit_bookings") || "[]");
    const quotes   = JSON.parse(localStorage.getItem("skipit_quotes")   || "[]");

    const bCount = document.getElementById("booking-count");
    const qCount = document.getElementById("quote-count");
    const pCount = document.getElementById("pending-count");

    if (bCount) bCount.textContent = bookings.length;
    if (qCount) qCount.textContent = quotes.length;
    if (pCount) pCount.textContent = [...bookings, ...quotes].filter(x => x.status === "Pending").length;

    // BOOKINGS TABLE
    const bTable = document.getElementById("bookings-table");
    if (bTable) {
      bTable.innerHTML = bookings.length ? `
        <table>
          <thead><tr>
            <th>Ref</th><th>Name</th><th>Email</th><th>Phone</th>
            <th>Address</th><th>Trailer</th><th>Dates</th><th>Est.</th><th>Status</th><th>Submitted</th>
          </tr></thead>
          <tbody>${bookings.map(b => `
            <tr>
              <td><code>${b.id}</code></td>
              <td><strong>${b.firstName || ''} ${b.lastName || ''}</strong></td>
              <td><a href="mailto:${b.email || ''}">${b.email || '-'}</a></td>
              <td><a href="tel:${b.phone || ''}">${b.phone || '-'}</a></td>
              <td>${b.address || '-'}</td>
              <td>${b.trailer || '-'}</td>
              <td>${b.dropoff || '-'} to ${b.collect || '-'}</td>
              <td><strong>${b.estimate || '-'}</strong></td>
              <td>
                <select onchange="updateStatus('bookings','${b.id}',this.value)">
                  ${["Pending","Confirmed","Collected","Cancelled"].map(s =>
                    `<option${b.status===s?" selected":""}>${s}</option>`).join("")}
                </select>
              </td>
              <td style="font-size:0.75rem;color:#888">${b.submitted}</td>
            </tr>`).join("")}
          </tbody>
        </table>` : "<p style='padding:15px;color:#888'>No bookings yet.</p>";
    }

    // QUOTES TABLE
    const qTable = document.getElementById("quotes-table");
    if (qTable) {
      qTable.innerHTML = quotes.length ? `
        <table>
          <thead><tr>
            <th>Ref</th><th>Name</th><th>Email</th><th>Phone</th>
            <th>Address / Postcode</th><th>Waste</th><th>Volume</th><th>Urgency</th><th>Status</th><th>Submitted</th>
          </tr></thead>
          <tbody>${quotes.map(q => `
            <tr>
              <td><code>${q.id}</code></td>
              <td><strong>${q.firstName || ''} ${q.lastName || ''}</strong></td>
              <td><a href="mailto:${q.email || ''}">${q.email || '-'}</a></td>
              <td><a href="tel:${q.phone || ''}">${q.phone || '-'}</a></td>
              <td>${q.address || '-'}</td>
              <td>${q.waste || '-'}</td>
              <td>${q.volume || '—'}</td>
              <td>${q.urgency || '—'}</td>
              <td>
                <select onchange="updateStatus('quotes','${q.id}',this.value)">
                  ${["Pending","Quoted","Booked","Declined"].map(s =>
                    `<option${q.status===s?" selected":""}>${s}</option>`).join("")}
                </select>
              </td>
              <td style="font-size:0.75rem;color:#888">${q.submitted}</td>
            </tr>`).join("")}
          </tbody>
        </table>` : "<p style='padding:15px;color:#888'>No quote requests yet.</p>";
    }
  }
}