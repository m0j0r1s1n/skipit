/**
 * SkipIt Admin & Application Logic
 */

document.addEventListener("DOMContentLoaded", () => {
  // Check if admin page elements exist on the current page
  const loginForm = document.getElementById("login-form");
  const passwordInput = document.getElementById("password-input");
  const loginError = document.getElementById("login-error");
  const adminDashboard = document.getElementById("admin-dashboard");
  const loginContainer = document.getElementById("login-container");
  const logoutBtn = document.getElementById("logout-btn");

  // Initialize session state check for admin pages
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

      // Show temporary loading state
      setLoadingState(true);

      try {
        // Send request to Cloudflare Worker endpoint
        const response = await fetch("/api/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password: enteredPassword }),
        });

        const result = await response.json();

        if (response.ok && result.success) {
          // Authentication successful
          sessionStorage.setItem("skipit_admin_auth", "true");
          showDashboard();
        } else {
          // Password failed server verification
          showError(result.message || "Incorrect password. Access denied.");
          if (passwordInput) passwordInput.value = "";
        }
      } catch (err) {
        console.error("Login request error:", err);
        showError("Server error. Please check your network and try again.");
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

  // --- Helper Functions ---

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
});