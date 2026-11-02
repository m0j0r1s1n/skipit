(function () {
  var GA_ID = "G-2FMLZY013F";
  var KEY = "skipit_analytics_consent";

  function loadAnalytics() {
    if (window.__skipitGaLoaded) return;
    window.__skipitGaLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID);
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
  }

  function readChoice() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function saveChoice(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* storage unavailable */ }
  }

  function showBanner() {
    var box = document.createElement("div");
    box.setAttribute("role", "region");
    box.setAttribute("aria-label", "Cookie consent");
    box.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;max-width:440px;z-index:9999;" +
      "background:#1a1815;color:#fff;padding:16px 18px;border-radius:12px;font:14px/1.5 system-ui,sans-serif;" +
      "box-shadow:0 10px 40px rgba(0,0,0,.35)";

    var text = document.createElement("p");
    text.style.cssText = "margin:0 0 12px";
    text.appendChild(document.createTextNode("We use Google Analytics cookies to understand how the site is used. They are only set if you accept. "));
    var link = document.createElement("a");
    link.href = "/privacy";
    link.textContent = "Privacy notice";
    link.style.color = "#e8750a";
    text.appendChild(link);

    function makeButton(label, primary, value) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      b.style.cssText = "cursor:pointer;border-radius:8px;padding:9px 16px;font:600 14px system-ui,sans-serif;margin-right:8px;" +
        (primary ? "background:#e8750a;color:#fff;border:1px solid #e8750a" : "background:transparent;color:#fff;border:1px solid #888");
      b.addEventListener("click", function () {
        saveChoice(value);
        if (value === "granted") loadAnalytics();
        box.remove();
      });
      return b;
    }

    box.appendChild(text);
    box.appendChild(makeButton("Accept", true, "granted"));
    box.appendChild(makeButton("Reject", false, "denied"));
    document.body.appendChild(box);
  }

  var choice = readChoice();
  if (choice === "granted") loadAnalytics();
  else if (choice !== "denied") showBanner();
})();
