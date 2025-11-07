// LOGIN LOGIC - Adaptive Trading System UI
document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const loading = document.getElementById("loading");
  loading.classList.remove("hidden");

  // Mock authentication delay
  setTimeout(() => {
    loading.classList.add("hidden");

    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    // Simple mock validation
    if (email === "admin@adaptive.ai" && password === "12345") {
      localStorage.setItem("authUser", email);
      window.location.href = "index.html";
    } else {
      alert("Invalid credentials. Please try again.");
    }
  }, 1800);
});