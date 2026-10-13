// ini kerjaan cikooo
import { requireLogin } from "./auth.js";
import { clearSession, getServices, getTickets, saveTickets } from "./storage.js";
import { STORAGE_KEYS } from "./types.js";
const POLL_INTERVAL = 2500;
const session = requireLogin();
const grid = document.querySelector("#service-card-grid");
const message = document.querySelector("#ticket-message");
const issuedTicket = document.querySelector("#issued-ticket");
const currentUser = document.querySelector("#current-user");
const logoutButton = document.querySelector("#logout-button");
const PRIORITIES = [
    { value: "normal", label: "Normal" },
    { value: "lansia", label: "Lansia" },
    { value: "disabilitas", label: "Disabilitas" },
    { value: "vip", label: "VIP" }
];
let lastSnapshot = "";
function formatTicketNumber(code, number) {
    return `${code}-${String(number).padStart(3, "0")}`;
}
function createElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
}
function issueTicket(serviceId, priority) {
    let service;
    const services = getServices();
    for (const item of services) {
        if (item.id === serviceId && item.active) {
            service = item;
            break;
        }
    }
    if (!service) {
        throw new Error("Jenis antrian tidak aktif atau tidak ditemukan.");
    }
    const tickets = getTickets();
    const countersText = localStorage.getItem(STORAGE_KEYS.counters);
    let counters = {};
    if (countersText) {
        try {
            const parsed = JSON.parse(countersText);
            if (typeof parsed === "object" &&
                parsed !== null &&
                !Array.isArray(parsed)) {
                counters = parsed;
            }
        }
        catch {
            counters = {};
        }
    }
    let highestNumber = 0;
    for (const ticket of tickets) {
        if (ticket.serviceId === serviceId &&
            ticket.number > highestNumber) {
            highestNumber = ticket.number;
        }
    }
    const counter = counters[serviceId];
    const previousNumber = typeof counter === "number" && counter >= 0 ? counter : 0;
    const number = Math.max(previousNumber, highestNumber) + 1;
    const ticket = {
        id: `${serviceId}-${number}`,
        number,
        serviceId,
        priority,
        status: "waiting",
        createdAt: new Date().toISOString()
    };
    counters[serviceId] = number;
    saveTickets([...tickets, ticket]);
    localStorage.setItem(STORAGE_KEYS.counters, JSON.stringify(counters));
    return ticket;
}
function getSelectedPriorities() {
    const selected = {};
    if (!grid)
        return selected;
    const selects = grid.querySelectorAll("select");
    for (let index = 0; index < selects.length; index++) {
        const select = selects[index];
        selected[select.name] = select.value;
    }
    return selected;
}
function renderServiceCard(service, tickets, selectedPriority) {
    const card = createElement("article", "service-pick-card", "");
    const heading = createElement("div", "queue-card-heading", "");
    heading.appendChild(createElement("h2", "", service.name));
    heading.appendChild(createElement("span", "queue-service-code", service.code));
    const waitingCount = tickets.filter((ticket) => ticket.serviceId === service.id && ticket.status === "waiting").length;
    const waitingLabel = createElement("span", "queue-waiting-count", `${waitingCount} tiket menunggu`);
    const form = document.createElement("form");
    const label = document.createElement("label");
    label.textContent = "Tingkat prioritas";
    const select = document.createElement("select");
    select.name = service.id;
    select.setAttribute("aria-label", `Prioritas ${service.name}`);
    for (const priority of PRIORITIES) {
        const option = document.createElement("option");
        option.value = priority.value;
        option.textContent = priority.label;
        select.appendChild(option);
    }
    if (selectedPriority)
        select.value = selectedPriority;
    label.appendChild(select);
    const button = document.createElement("button");
    button.type = "submit";
    button.textContent = "Ambil Nomor";
    form.appendChild(label);
    form.appendChild(button);
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        let priority;
        for (const item of PRIORITIES) {
            if (item.value === select.value) {
                priority = item.value;
                break;
            }
        }
        if (!priority || !message || !issuedTicket) {
            if (message) {
                message.textContent =
                    "Prioritas tidak valid. Silakan pilih kembali.";
                message.className = "message error queue-message";
            }
            return;
        }
        try {
            const ticket = issueTicket(service.id, priority);
            const number = formatTicketNumber(service.code, ticket.number);
            message.textContent = `Nomor antrean berhasil diterbitkan: ${number}`;
            message.className = "message success queue-message";
            while (issuedTicket.firstChild) {
                issuedTicket.removeChild(issuedTicket.firstChild);
            }
            issuedTicket.appendChild(document.createTextNode("Nomor antrean Anda"));
            issuedTicket.appendChild(createElement("strong", "issued-ticket-number", number));
            issuedTicket.hidden = false;
            refresh();
        }
        catch (error) {
            message.textContent =
                error instanceof Error
                    ? `Nomor gagal diterbitkan: ${error.message}`
                    : "Nomor gagal diterbitkan. Silakan coba lagi.";
            message.className = "message error queue-message";
        }
    });
    card.appendChild(heading);
    card.appendChild(waitingLabel);
    card.appendChild(form);
    return card;
}
function refresh(force = false) {
    if (!grid)
        return;
    const services = getServices().filter((service) => service.active);
    const tickets = getTickets();
    const snapshot = JSON.stringify([services, tickets]);
    if (!force && snapshot === lastSnapshot)
        return;
    lastSnapshot = snapshot;
    const selectedPriorities = getSelectedPriorities();
    while (grid.firstChild) {
        grid.removeChild(grid.firstChild);
    }
    if (services.length === 0) {
        grid.appendChild(createElement("p", "queue-empty", "Belum ada jenis antrean yang aktif. Silakan coba lagi nanti."));
        return;
    }
    for (const service of services) {
        grid.appendChild(renderServiceCard(service, tickets, selectedPriorities[service.id]));
    }
}
function updateQueueServices() {
    refresh();
    window.setTimeout(updateQueueServices, POLL_INTERVAL);
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
refresh(true);
window.setTimeout(updateQueueServices, POLL_INTERVAL);
// ini kerjaan cikooo
