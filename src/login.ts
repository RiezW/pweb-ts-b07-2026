
import { login } from "./auth.js";
import { getSession } from "./storage.js";

const form = document.querySelector<HTMLFormElement>(
  "#login-form"
);
const usernameInput = document.querySelector<HTMLInputElement>(
  "#username"
);
const passwordInput = document.querySelector<HTMLInputElement>(
  "#password"
);
const submitButton = document.querySelector<HTMLButtonElement>(
  "#login-button"
);
const message = document.querySelector<HTMLParagraphElement>(
  "#login-message"
);

if (
  form &&
  usernameInput &&
  passwordInput &&
  submitButton &&
  message
) {
  const existingSession = getSession();

  if (existingSession) {
    redirectByRole(existingSession.role);
  }

  form.addEventListener("submit", async (event: SubmitEvent) => {
    event.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showMessage("Username dan password wajib diisi.");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Memverifikasi...";
    message.textContent = "";

    try {
      const session = await login(username, password);
      redirectByRole(session.role);
    } catch (error: unknown) {
      if (error instanceof TypeError) {
        showMessage("Koneksi gagal. Periksa internetmu.");
      } else if (error instanceof Error) {
        showMessage(error.message);
      } else {
        showMessage("Terjadi kesalahan yang tidak diketahui.");
      }
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Login";
    }
  });

  function showMessage(text: string): void {
    if (message) {
      message.textContent = text;
    }
  }

  function redirectByRole(
    role: "admin" | "moderator" | "user"
  ): void {
    if (role === "admin" || role === "moderator") {
      window.location.href = "index.html";
    } else {
      window.location.href = "operator.html";
    }
  }
}
