// login.js

(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);

  const authForm = $("#authForm");
  const emailInput = $("#email");
  const passwordInput = $("#password");
  const confirmPasswordInput = $("#confirmPassword");
  const confirmPasswordLabel = $("#confirmPasswordLabel");
  const authTitle = $("#authTitle");
  const authSubtitle = $("#authSubtitle");
  const authButtonText = $("#authButtonText");
  const authMessage = $("#authMessage");
  const loadingScreen = $("#loadingScreen");
  const authTabs = document.querySelectorAll(".auth-tab");

  let mode = "login";

  function showMessage(message, type = "error") {
    authMessage.textContent = message;
    authMessage.className = `form-message ${type}`;
  }

  function setLoading(isLoading) {
    loadingScreen.classList.toggle("hidden", !isLoading);
    authForm.querySelector("button").disabled = isLoading;
  }

  function updateMode(nextMode) {
    mode = nextMode;

    authTabs.forEach((tab) => {
      tab.classList.toggle("active", tab.dataset.mode === mode);
    });

    const signup = mode === "signup";

    authTitle.textContent = signup
      ? "Create your ninja profile"
      : "Welcome back, shinobi";

    authSubtitle.textContent = signup
      ? "Choose your path and start tracking your missions."
      : "Enter the village and continue your weekly missions.";

    authButtonText.textContent = signup
      ? "Begin your journey"
      : "Enter the village";

    confirmPasswordInput.classList.toggle("hidden", !signup);
    confirmPasswordLabel.classList.toggle("hidden", !signup);
    confirmPasswordInput.required = signup;
    showMessage("");
  }

  function friendlyAuthError(error) {
    const messages = {
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/user-not-found": "No shinobi was found with that email.",
      "auth/wrong-password": "The password is incorrect.",
      "auth/invalid-credential": "The email or password is incorrect.",
      "auth/email-already-in-use": "An account already exists with this email.",
      "auth/weak-password": "Use a password with at least 6 characters.",
      "auth/too-many-requests": "Too many attempts. Try again later.",
      "auth/network-request-failed": "Network error. Check your connection."
    };

    return messages[error.code] || "The mission could not be completed. Try again.";
  }

  authTabs.forEach((tab) => {
    tab.addEventListener("click", () => updateMode(tab.dataset.mode));
  });

  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!email || !password) {
      showMessage("Email and password are required.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      showMessage("The passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      if (mode === "signup") {
        const credential = await auth.createUserWithEmailAndPassword(email, password);

        await db.collection("users").doc(credential.user.uid).set({
          email: credential.user.email,
          character: "naruto",
          theme: "dark",
          soundEnabled: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      } else {
        await auth.signInWithEmailAndPassword(email, password);
      }

      window.location.href = "index.html";
    } catch (error) {
      setLoading(false);
      showMessage(friendlyAuthError(error));
    }
  });

  auth.onAuthStateChanged((user) => {
    if (user) {
      window.location.href = "index.html";
    } else {
      setTimeout(() => loadingScreen.classList.add("hidden"), 350);
    }
  });
})();
