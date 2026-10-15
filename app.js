

import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// ============================================
// 1. GET HTML ELEMENTS
// ============================================

const authForm = document.getElementById("authForm");
const formTitle = document.getElementById("formTitle");
const formSubtitle = document.getElementById("formSubtitle");

const nameGroup = document.getElementById("nameGroup");
const fullNameInput = document.getElementById("fullName");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const submitBtn = document.getElementById("submitBtn");
const switchModeBtn = document.getElementById("switchMode");
const switchLabel = document.getElementById("switchLabel");

const authMessage = document.getElementById("authMessage");
const togglePasswordBtn = document.getElementById("togglePassword");

// Stop early if the expected HTML elements are missing.
if (
  !authForm ||
  !formTitle ||
  !formSubtitle ||
  !emailInput ||
  !passwordInput ||
  !submitBtn ||
  !switchModeBtn ||
  !switchLabel ||
  !authMessage
) {
  throw new Error(
    "TaskFlow HTML elements are missing. Check index.html IDs."
  );
}

// ============================================
// 2. APPLICATION STATE
// ============================================

let isRegisterMode = false;
let isSubmitting = false;

// ============================================
// 3. SHOW SUCCESS OR ERROR MESSAGES
// ============================================

function showMessage(message, type = "error") {
  authMessage.textContent = message;
  authMessage.className = `message ${type}`;
}

// ============================================
// 4. SWITCH LOGIN / REGISTRATION MODE
// ============================================

function updateFormMode() {
  if (isSubmitting) return;

  isRegisterMode = !isRegisterMode;

  if (nameGroup) {
    nameGroup.classList.toggle("hidden", !isRegisterMode);
  }

  if (fullNameInput) {
    fullNameInput.required = isRegisterMode;
    fullNameInput.value = "";
  }

  formTitle.textContent = isRegisterMode
    ? "Create your account"
    : "Welcome back.";

  formSubtitle.textContent = isRegisterMode
    ? "Sign up to start organizing your tasks."
    : "Sign in to continue to your workspace.";

  submitBtn.innerHTML = isRegisterMode
    ? 'Create account <span aria-hidden="true">→</span>'
    : 'Sign in <span aria-hidden="true">→</span>';

  switchLabel.textContent = isRegisterMode
    ? "Already have an account?"
    : "Don't have an account?";

  switchModeBtn.textContent = isRegisterMode
    ? "Sign in"
    : "Create account";

  passwordInput.autocomplete = isRegisterMode
    ? "new-password"
    : "current-password";

  // Reset password visibility.
  passwordInput.type = "password";

  if (togglePasswordBtn) {
    togglePasswordBtn.textContent = "Show";
    togglePasswordBtn.setAttribute("aria-label", "Show password");
  }

  showMessage("");
}

switchModeBtn.addEventListener("click", updateFormMode);

// ============================================
// 5. SHOW / HIDE PASSWORD
// ============================================

if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";

    passwordInput.type = isHidden ? "text" : "password";

    togglePasswordBtn.textContent = isHidden ? "Hide" : "Show";

    togglePasswordBtn.setAttribute(
      "aria-label",
      isHidden ? "Hide password" : "Show password"
    );
  });
}

// ============================================
// 6. FRIENDLY FIREBASE ERROR MESSAGES
// ============================================

function getErrorMessage(error) {
  const messages = {
    "auth/email-already-in-use":
      "This email is already registered. Please sign in.",

    "auth/invalid-email":
      "Please enter a valid email address.",

    "auth/invalid-credential":
      "Incorrect email or password. Please try again.",

    "auth/user-not-found":
      "No account was found. Please register first.",

    "auth/wrong-password":
      "Incorrect password. Please try again.",

    "auth/weak-password":
      "Your password is too weak. Choose a stronger password.",

    "auth/too-many-requests":
      "Too many attempts. Please try again later.",

    "auth/network-request-failed":
      "Network error. Check your internet connection.",

    "auth/operation-not-allowed":
      "Email/password sign-in is not enabled in Firebase Authentication.",

    "permission-denied":
      "Firestore denied access. Check your Firestore security rules.",

    "unavailable":
      "Firebase is temporarily unavailable. Please try again."
  };

  return messages[error.code] ||
    "Something went wrong. Check the browser Console for details.";
}

// ============================================
// 7. REDIRECT TO DASHBOARD
// ============================================

function openDashboard() {
  // Resolve the dashboard relative to the current page.
  const dashboardUrl = new URL(
    "dashboard.html",
    window.location.href
  );

  window.location.assign(dashboardUrl.href);
}

// ============================================
// 8. REGISTER OR SIGN IN
// ============================================

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  // Prevent duplicate submissions.
  if (isSubmitting) return;

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const fullName = fullNameInput
    ? fullNameInput.value.trim()
    : "";

  if (!email || !password) {
    showMessage("Please enter your email and password.");
    return;
  }

  if (isRegisterMode && !fullName) {
    showMessage("Please enter your full name.");
    return;
  }

  if (isRegisterMode && password.length < 6) {
    showMessage("Password must contain at least 6 characters.");
    return;
  }

  isSubmitting = true;
  submitBtn.disabled = true;

  submitBtn.textContent = isRegisterMode
    ? "Creating account..."
    : "Signing in...";

  showMessage("");

  try {
    // ----------------------------------------
    // REGISTRATION
    // ----------------------------------------

    if (isRegisterMode) {
      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );

      const user = userCredential.user;

      // Save the user's display name.
      await updateProfile(user, {
        displayName: fullName
      });

      // Create the user's Firestore profile.
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName: fullName,
        email: user.email,
        createdAt: serverTimestamp()
      });

      showMessage(
        "Account created successfully! Opening dashboard...",
        "success"
      );

      openDashboard();
      return;
    }

    // ----------------------------------------
    // LOGIN
    // ----------------------------------------

    const userCredential =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    console.log(
      "Firebase login successful:",
      userCredential.user.uid
    );

    showMessage(
      "Login successful! Opening dashboard...",
      "success"
    );

    openDashboard();
    return;

  } catch (error) {
    console.error("TaskFlow authentication error:", error);

    showMessage(getErrorMessage(error), "error");

  } finally {
    isSubmitting = false;
    submitBtn.disabled = false;

    submitBtn.innerHTML = isRegisterMode
      ? 'Create account <span aria-hidden="true">→</span>'
      : 'Sign in <span aria-hidden="true">→</span>';
  }
});

// ============================================
// 9. MONITOR FIREBASE AUTHENTICATION
// ============================================

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Current signed-in user:", user.uid);
  } else {
    console.log("No Firebase user is signed in.");
  }
});

// ============================================
// 10. LOGOUT HELPER
// ============================================

export async function logoutUser() {
  try {
    await signOut(auth);

    window.location.replace("./index.html");
  } catch (error) {
    console.error("TaskFlow logout error:", error);
    throw error;
  }
}
