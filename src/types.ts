export type UserRole = "admin" | "moderator" | "user";

export type QueuePriority =
  | "normal"
  | "lansia"
  | "disabilitas"
  | "vip";

export type QueueStatus =
  | "waiting"
  | "called"
  | "done"
  | "skipped";

export interface AuthSession {
  token: string;
  role: UserRole;
  firstName: string;
}

export interface QueueService {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface QueueTicket {
  id: string;
  number: number;
  serviceId: string;
  priority: QueuePriority;
  status: QueueStatus;
  createdAt: string;
  skippedAt?: string;
}

export const STORAGE_KEYS = {
  auth: "hospital_auth",
  services: "hospital_services",
  tickets: "hospital_tickets",
  counters: "hospital_counters"
} as const;