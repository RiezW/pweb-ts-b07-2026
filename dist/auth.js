import { saveSession, getSession } from "./storage.js";
async function getUserRole(userId) {
    const response = await fetch(`https://dummyjson.com/users/${userId}`);
    if (!response.ok) {
        throw new Error("Gagal mengambil data role pengguna.");
    }
    const user = await response.json();
    if (user.role === "admin" ||
        user.role === "moderator" ||
        user.role === "user") {
        return user.role;
    }
    throw new Error("Role pengguna tidak tersedia atau tidak sesuai.");
}
export async function login(username, password) {
    const response = await fetch("https://dummyjson.com/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            username,
            password,
            expiresInMins: 30
        })
    });
    if (!response.ok) {
        if (response.status === 400) {
            throw new Error("Username atau password salah.");
        }
        throw new Error("Login gagal. Silakan coba lagi.");
    }
    const result = await response.json();
    const role = await getUserRole(result.id);
    const session = {
        token: result.accessToken,
        role,
        firstName: result.firstName
    };
    saveSession(session);
    return session;
}
export function requireLogin() {
    const session = getSession();
    if (!session) {
        window.location.href = "login.html";
        throw new Error("Pengguna belum login.");
    }
    return session;
}
export function requireAdmin() {
    const session = requireLogin();
    if (session.role !== "admin" &&
        session.role !== "moderator") {
        window.location.href = "login.html";
        throw new Error("Akses hanya untuk admin.");
    }
    return session;
}
