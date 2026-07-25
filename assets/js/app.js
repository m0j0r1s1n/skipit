// ─── CONFIG ──────────────────────────────────────────────────────────────────
const WA_NUMBER  = "447494110411";
const ADMIN_PASS = "n@3tn5Wv@x^qoj";

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
  // Switch to quote form
  window.switchTab("quote");

  if (wasteType) {
    const select = document.querySelector("#quoteForm select[name=waste_type]");
    if (select) select.value = wasteType;
  }

  // Scroll to booking/quote section
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

// ── 3. FORM HANDLERS ──────────────────────────────────────────────────────────
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
    type: "booking",
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

// ── 4. INITIALIZE DATES ON LOAD ───────────────────────────────────────────────
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
});