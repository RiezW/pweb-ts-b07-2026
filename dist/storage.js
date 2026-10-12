import { STORAGE_KEYS } from "./types.js";
export function getSession() {
    const data = localStorage.getItem(STORAGE_KEYS.auth);
    if (!data) {
        return null;
    }
    try {
        return JSON.parse(data);
    }
    catch {
        localStorage.removeItem(STORAGE_KEYS.auth);
        return null;
    }
}
export function saveSession(session) {
    localStorage.setItem(STORAGE_KEYS.auth, JSON.stringify(session));
}
export function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.auth);
}
export function getServices() {
    const data = localStorage.getItem(STORAGE_KEYS.services);
    if (!data) {
        return [];
    }
    try {
        return JSON.parse(data);
    }
    catch {
        return [];
    }
}
export function saveServices(services) {
    localStorage.setItem(STORAGE_KEYS.services, JSON.stringify(services));
}
export function getTickets() {
    const data = localStorage.getItem(STORAGE_KEYS.tickets);
    if (!data) {
        return [];
    }
    try {
        return JSON.parse(data);
    }
    catch {
        return [];
    }
}
export function saveTickets(tickets) {
    localStorage.setItem(STORAGE_KEYS.tickets, JSON.stringify(tickets));
}
