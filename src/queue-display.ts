// ini kerjaan cikooo
import { requireLogin } from "./auth.js";
import { clearSession, getServices, getTickets } from "./storage.js";
import type { QueueService, QueueTicket } from "./types.js";

const POLL_INTERVAL = 2500;
const session = requireLogin();

const grid = document.querySelector<HTMLDivElement>(
  "#queue-display-grid"
);
const updatedLabel = document.querySelector<HTMLElement>(
  "#queue-updated"
);
const fullscreenButton =
  document.querySelector<HTMLButtonElement>("#fullscreen-button");
const currentUser = document.querySelector<HTMLElement>("#current-user");
const logoutButton =
  document.querySelector<HTMLButtonElement>("#logout-button");

function formatTicketNumber(code: string, number: number): string {
  return `${code}-${String(number).padStart(3, "0")}`;
}

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text: string
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function renderServiceCard(
  service: QueueService,
  tickets: QueueTicket[]
): HTMLElement {
  const card = createElement("article", "queue-display-card", "");
  const heading = createElement("div", "queue-card-heading", "");
  heading.appendChild(createElement("h2", "", service.name));
  heading.appendChild(
    createElement("span", "queue-service-code", service.code)
  );

  let called: QueueTicket | undefined;
  for (const ticket of tickets) {
    if (
      ticket.serviceId === service.id &&
      ticket.status === "called"
    ) {
      called = ticket;
      break;
    }
  }
  const waitingCount = tickets.filter(
    (ticket) =>
      ticket.serviceId === service.id && ticket.status === "waiting"
  ).length;

  card.appendChild(heading);

  if (called) {
    card.appendChild(
      createElement("span", "queue-called-label", "Sedang dipanggil")
    );
    card.appendChild(
      createElement(
        "strong",
        "queue-called-number",
        formatTicketNumber(service.code, called.number)
      )
    );
  } else {
    card.appendChild(
      createElement(
        "span",
        "queue-no-call",
        "Belum ada nomor dipanggil"
      )
    );
  }

  card.appendChild(
    createElement(
      "span",
      "queue-waiting-count",
      `${waitingCount} tiket menunggu`
    )
  );

  return card;
}

function render(): void {
  if (!grid) return;

  const services = getServices().filter((service) => service.active);
  const tickets = getTickets();
  while (grid.firstChild) {
    grid.removeChild(grid.firstChild);
  }

  if (services.length === 0) {
    grid.appendChild(
      createElement(
        "p",
        "queue-empty",
        "Belum ada jenis antrean yang aktif."
      )
    );
  } else {
    for (const service of services) {
      grid.appendChild(renderServiceCard(service, tickets));
    }
  }

  if (updatedLabel) {
    updatedLabel.textContent =
      "Diperbarui otomatis setiap 2,5 detik";
  }
}

async function toggleFullscreen(): Promise<void> {
  if (!fullscreenButton) return;

  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    if (updatedLabel) {
      updatedLabel.textContent =
        "Mode layar penuh tidak dapat diaktifkan di browser ini.";
    }
  }
}

if (fullscreenButton) {
  fullscreenButton.addEventListener("click", () => {
    toggleFullscreen();
  });
}

if (currentUser) {
  currentUser.textContent =
    `Masuk sebagai ${session.firstName} (${session.role})`;
}

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    clearSession();
    window.location.href = "login.html";
  });
}

document.addEventListener("fullscreenchange", () => {
  if (fullscreenButton) {
    fullscreenButton.textContent = document.fullscreenElement
      ? "Keluar Layar Penuh"
      : "Layar Penuh";
  }
});

function updateQueueDisplay(): void {
  render();
  window.setTimeout(updateQueueDisplay, POLL_INTERVAL);
}

updateQueueDisplay();
// ini kerjaan cikooo
