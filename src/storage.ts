
import {
  STORAGE_KEYS,
  type AuthSession,
  type QueueService,
  type QueueTicket
} from "./types.js";

export function getSession(): AuthSession | null {
  const data = localStorage.getItem(STORAGE_KEYS.auth);

  if (!data) {
    return null;
  }

  try {
    return JSON.parse(data) as AuthSession;
  } catch {
    localStorage.removeItem(STORAGE_KEYS.auth);
    return null;
  }
}

export function saveSession(session: AuthSession): void {
  localStorage.setItem(
    STORAGE_KEYS.auth,
    JSON.stringify(session)
  );
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.auth);
}

export function getServices(): QueueService[] {
  const data = localStorage.getItem(STORAGE_KEYS.services);

  if (!data) {
    return [];
  }

  try {
    return JSON.parse(data) as QueueService[];
  } catch {
    return [];
  }
}

export function saveServices(services: QueueService[]): void {
  localStorage.setItem(
    STORAGE_KEYS.services,
    JSON.stringify(services)
  );
}

export function getTickets(): QueueTicket[] {
  const data = localStorage.getItem(STORAGE_KEYS.tickets);

  if (!data) {
    return [];
  }

  try {
    return JSON.parse(data) as QueueTicket[];
  } catch {
    return [];
  }
}

export function saveTickets(tickets: QueueTicket[]): void {
  localStorage.setItem(
    STORAGE_KEYS.tickets,
    JSON.stringify(tickets)
  );
}
