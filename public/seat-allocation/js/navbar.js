// Navbar Component
class Navbar {
  constructor(currentPage = null) {
    this.currentPage = currentPage || this.getCurrentPage();
    
  }

  getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split("/").pop() || "dashboard6.html";
    return filename;
  }

  // For redirecting

  createNavbarHTML() {
    return ``;
  }

  // For styling

  createNavbarStyles() {
    return `
      <style>
        body {
          font-family: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
          margin: 0;
          overflow-x: hidden;
          min-height: 100vh;
          background-color: #f8fafc;
          color: #1e293b;
        }

        .main, .main-content {
          margin-left: 0 !important;
          padding: 24px !important;
          width: 100% !important;
          height: auto !important;
          min-height: calc(100vh - 80px) !important;
          transition: none !important;
        }

        .top-navbar, .sidebar {
          display: none !important;
        }
        
        /* Ensure layout doesn't restrict display */
        .layout {
          display: block;
          height: auto;
        }
      </style>
    `;
  }

  init() {
    // Add styles to head
    document.head.insertAdjacentHTML("beforeend", this.createNavbarStyles());

    // Add navbar HTML to body
    document.body.insertAdjacentHTML("afterbegin", this.createNavbarHTML());

    // Initialize navbar functionality
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    const menuToggle = document.getElementById("menu-toggle");
    const sidebar = document.getElementById("sidebar");
    const main = document.getElementById("main") || document.getElementById("main-content");
    const topNavbar = document.getElementById("top-navbar");
    const logoutBtn = document.getElementById("logout-btn");

    if (menuToggle && sidebar && topNavbar) {
      menuToggle.addEventListener("click", () => {
        const isDesktop = window.innerWidth > 768;
        
        if (isDesktop) {
          // Desktop behavior: toggle sidebar visibility
          sidebar.classList.toggle("collapsed");
          if (main) main.classList.toggle("full");
          topNavbar.classList.toggle("collapsed");
        } else {
          // Mobile behavior: toggle sidebar overlay
          sidebar.classList.toggle("collapsed");
        }
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to logout?")) {
          // Use the global authManager from script.js
          if (typeof authManager !== "undefined") {
            authManager.logout();
          } else {
            // Fallback if authManager is not available
            localStorage.removeItem("isLoggedIn");
            localStorage.removeItem("userId");
            localStorage.removeItem("loginTime");
            window.location.href = "index.html";
          }
        }
      });
    }
  }
}

// Only auto-initialize if not manually initialized
// let navbarInitialized = false;

// document.addEventListener("DOMContentLoaded", () => {
//   // Check if navbar was manually initialized
//   if (!navbarInitialized && !document.getElementById("sidebar")) {
//     new Navbar().init();
//     navbarInitialized = true;
//   }
// });

// Export for module usage if needed
if (typeof module !== "undefined" && module.exports) {
  module.exports = Navbar;
}

