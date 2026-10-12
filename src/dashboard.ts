import { requireAdmin } from "./auth.js";
import {
  clearSession,
  getServices,
  saveServices,
  getTickets,
  saveTickets
} from "./storage.js";
import {
  STORAGE_KEYS,
  type QueueService,
  type QueueTicket,
  type QueuePriority
} from "./types.js";

// Proteksi halaman: hanya admin dan moderator.
const session = requireAdmin();

// Elemen navbar
const userName = document.querySelector<HTMLElement>("#user-name");
const userRole = document.querySelector<HTMLElement>("#user-role");
const logoutButton =
  document.querySelector<HTMLButtonElement>("#logout-button");

// Elemen manajemen layanan
const serviceForm =
  document.querySelector<HTMLFormElement>("#service-form");
const serviceCode =
  document.querySelector<HTMLInputElement>("#service-code");
const serviceName =
  document.querySelector<HTMLInputElement>("#service-name");
const serviceMessage =
  document.querySelector<HTMLElement>("#service-message");
const serviceTable =
  document.querySelector<HTMLTableSectionElement>("#service-table");

// Elemen reset antrian
const resetButton =
  document.querySelector<HTMLButtonElement>("#reset-queue-button");
const resetMessage =
  document.querySelector<HTMLElement>("#reset-message");

// Elemen tiket manual
const manualTicketForm =
  document.querySelector<HTMLFormElement>("#manual-ticket-form");
const ticketService =
  document.querySelector<HTMLSelectElement>("#ticket-service");
const ticketPriority =
  document.querySelector<HTMLSelectElement>("#ticket-priority");
const ticketMessage =
  document.querySelector<HTMLElement>("#ticket-message");
const ticketList =
  document.querySelector<HTMLElement>("#ticket-list");

// Label status tiket untuk ditampilkan
const STATUS_LABELS: Record<string, string> = {
  waiting: "Menunggu",
  called: "Dipanggil",
  done: "Selesai",
  skipped: "Dilewati"
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatTicketNumber(code: string, number: number): string {
  return `${code}-${String(number).padStart(3, "0")}`;
}

if (
  userName &&
  userRole &&
  logoutButton &&
  serviceForm &&
  serviceCode &&
  serviceName &&
  serviceMessage &&
  serviceTable &&
  resetButton &&
  resetMessage
) {
  userName.textContent = session.firstName;
  userRole.textContent = session.role;

  // Logout
  logoutButton.addEventListener("click", () => {
    clearSession();
    window.location.href = "login.html";
  });

  // Menampilkan pesan manajemen layanan
  function showServiceMessage(
    text: string,
    isError = false
  ): void {
    if (!serviceMessage) return;

    serviceMessage.textContent = text;
    serviceMessage.className = isError
      ? "message error"
      : "message success";
  }

  // Menampilkan daftar layanan
  function renderServices(): void {
    if (!serviceTable) return;

    const services = getServices();
    const tickets = getTickets();
    serviceTable.replaceChildren();

    if (services.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 4;
      cell.textContent = "Belum ada jenis antrian.";

      row.append(cell);
      serviceTable.append(row);
      return;
    }

    for (const service of services) {
      const row = document.createElement("tr");

      const codeCell = document.createElement("td");
      codeCell.textContent = service.code;

      // Jumlah tiket yang masih menunggu pada layanan ini
      const waitingCount = tickets.filter(
        (ticket) =>
          ticket.serviceId === service.id &&
          ticket.status === "waiting"
      ).length;

      const nameCell = document.createElement("td");

      const nameText = document.createElement("span");
      nameText.textContent = service.name;

      const waitingInfo = document.createElement("small");
      waitingInfo.className = "service-waiting";
      waitingInfo.textContent = `${waitingCount} menunggu`;

      nameCell.append(nameText, waitingInfo);

      const statusCell = document.createElement("td");
      statusCell.textContent = service.active
        ? "Aktif"
        : "Nonaktif";

      const actionCell = document.createElement("td");

      // Tombol aktif/nonaktif
      const toggleButton = document.createElement("button");
      toggleButton.type = "button";
      toggleButton.textContent = service.active
        ? "Nonaktifkan"
        : "Aktifkan";

      toggleButton.addEventListener("click", () => {
        const updated = getServices().map((item) =>
          item.id === service.id
            ? { ...item, active: !item.active }
            : item
        );

        saveServices(updated);
        renderServices();
        renderTicketServices();
        renderTickets();
      });

      // Tombol hapus
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Hapus";

      deleteButton.addEventListener("click", () => {
        const confirmed = window.confirm(
          `Hapus layanan ${service.name}?`
        );

        if (!confirmed) return;

        const updated = getServices().filter(
          (item) => item.id !== service.id
        );

        saveServices(updated);
        renderServices();
        renderTicketServices();
        renderTickets();
      });

      actionCell.append(toggleButton, deleteButton);
      row.append(codeCell, nameCell, statusCell, actionCell);
      serviceTable.append(row);
    }
  }

  // Menambah layanan baru
  serviceForm.addEventListener(
    "submit",
    (event: SubmitEvent) => {
      event.preventDefault();

      const code = serviceCode.value.trim();
      const name = serviceName.value.trim();

      if (!/^[A-Z]$/.test(code)) {
        showServiceMessage(
          "Kode harus tepat satu huruf kapital, misalnya A.",
          true
        );
        return;
      }

      if (!name) {
        showServiceMessage(
          "Nama layanan wajib diisi.",
          true
        );
        return;
      }

      const services = getServices();

      const duplicateCode = services.some(
        (item) =>
          item.code.toUpperCase() === code.toUpperCase()
      );

      const duplicateName = services.some(
        (item) =>
          item.name.trim().toLowerCase() === name.toLowerCase()
      );

      if (duplicateCode || duplicateName) {
        showServiceMessage(
          "Kode atau nama layanan sudah digunakan.",
          true
        );
        return;
      }

      const newService: QueueService = {
        id: crypto.randomUUID(),
        code,
        name,
        active: true
      };

      saveServices([...services, newService]);

      serviceForm.reset();
      showServiceMessage(
        "Jenis antrian berhasil ditambahkan."
      );

      renderServices();
      renderTicketServices();
    }
  );

  // Mengisi pilihan layanan aktif pada formulir tiket
  function renderTicketServices(): void {
    if (!ticketService) return;

    const previousValue = ticketService.value;
    ticketService.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Pilih layanan";
    ticketService.append(placeholder);

    const activeServices = getServices().filter(
      (service) => service.active
    );

    for (const service of activeServices) {
      const option = document.createElement("option");

      option.value = service.id;
      option.textContent =
        `${service.code} - ${service.name}`;

      ticketService.append(option);
    }

    if (
      activeServices.some(
        (service) => service.id === previousValue
      )
    ) {
      ticketService.value = previousValue;
    }
  }

  // Mengubah status satu tiket lalu menampilkan ulang daftar
  function updateTicketStatus(
    ticketId: string,
    nextStatus: QueueTicket["status"]
  ): void {
    const updated = getTickets().map((item) =>
      item.id === ticketId
        ? { ...item, status: nextStatus }
        : item
    );

    saveTickets(updated);
    renderTickets();
    renderServices();
  }

  // Membuat tombol aksi pada baris tiket
  function createTicketAction(
    label: string,
    className: string,
    onClick: () => void
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `ticket-action ${className}`.trim();
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  // Menampilkan daftar tiket, dikelompokkan per layanan
  function renderTickets(): void {
    if (!ticketList) return;

    const services = getServices();
    const tickets = getTickets();

    ticketList.replaceChildren();

    if (tickets.length === 0) {
      const empty = document.createElement("p");
      empty.className = "ticket-empty";
      empty.textContent = "Belum ada tiket.";
      ticketList.append(empty);
      return;
    }

    // Urutan grup mengikuti urutan layanan
    for (const service of services) {
      const serviceTickets = tickets
        .filter((ticket) => ticket.serviceId === service.id)
        .sort((a, b) => b.number - a.number);

      if (serviceTickets.length === 0) continue;

      const title = document.createElement("h3");
      title.className = "ticket-group-title";
      title.textContent = service.name;
      ticketList.append(title);

      for (const ticket of serviceTickets) {
        const row = document.createElement("div");
        row.className = "ticket-row";

        const number = document.createElement("span");
        number.className = "ticket-number";
        number.textContent = formatTicketNumber(
          service.code,
          ticket.number
        );

        const priority = document.createElement("span");
        priority.className = "ticket-tag";
        priority.textContent = capitalize(ticket.priority);

        const status = document.createElement("span");
        status.className = "ticket-status";
        status.textContent =
          STATUS_LABELS[ticket.status] ?? capitalize(ticket.status);

        const actions = document.createElement("span");
        actions.className = "ticket-actions";

        if (ticket.status === "waiting") {
          actions.append(
            createTicketAction("Panggil", "", () =>
              updateTicketStatus(ticket.id, "called")
            ),
            createTicketAction("Lewati", "skip", () =>
              updateTicketStatus(ticket.id, "skipped")
            )
          );
        } else if (ticket.status === "called") {
          actions.append(
            createTicketAction("Selesai", "done", () =>
              updateTicketStatus(ticket.id, "done")
            )
          );
        }

        row.append(number, priority, status, actions);
        ticketList.append(row);
      }
    }
  }

  // Menerbitkan tiket manual
  manualTicketForm?.addEventListener(
    "submit",
    (event: SubmitEvent) => {
      event.preventDefault();

      if (!ticketService || !ticketPriority || !ticketMessage) {
        return;
      }

      const serviceId = ticketService.value;
      const priorityValue = ticketPriority.value;

      const validPriorities: QueuePriority[] = [
        "normal",
        "lansia",
        "disabilitas",
        "vip"
      ];

      const priority = validPriorities.find(
        (item) => item === priorityValue
      );

      if (!priority) {
        ticketMessage.textContent = "Prioritas tidak valid.";
        return;
      }

      const service = getServices().find(
        (item) =>
          item.id === serviceId && item.active
      );

      if (!service) {
        ticketMessage.textContent =
          "Pilih layanan yang masih aktif.";
        return;
      }

      const tickets = getTickets();

      // Membaca penghitung nomor antrian
      const countersText = localStorage.getItem(
        STORAGE_KEYS.counters
      );

      let counters: Record<string, number> = {};

      if (countersText) {
        try {
          const parsed: unknown = JSON.parse(countersText);

          if (
            typeof parsed === "object" &&
            parsed !== null &&
            !Array.isArray(parsed)
          ) {
            for (const [key, value] of Object.entries(parsed)) {
              if (
                typeof value === "number" &&
                Number.isInteger(value) &&
                value >= 0
              ) {
                counters[key] = value;
              }
            }
          }
        } catch {
          counters = {};
        }
      }

      // Mencari nomor tertinggi pada layanan ini
      const highestNumber = tickets
        .filter((ticket) => ticket.serviceId === serviceId)
        .reduce(
          (highest, ticket) =>
            Math.max(highest, ticket.number),
          0
        );

      const nextNumber =
        Math.max(
          counters[serviceId] ?? 0,
          highestNumber
        ) + 1;

      counters[serviceId] = nextNumber;

      const ticket: QueueTicket = {
        id: crypto.randomUUID(),
        number: nextNumber,
        serviceId,
        priority,
        status: "waiting",
        createdAt: new Date().toISOString()
      };

      saveTickets([...tickets, ticket]);

      localStorage.setItem(
        STORAGE_KEYS.counters,
        JSON.stringify(counters)
      );

      ticketMessage.textContent =
        `Tiket ${formatTicketNumber(service.code, nextNumber)} berhasil diterbitkan.`;

      manualTicketForm.reset();
      renderTicketServices();
      renderTickets();
      renderServices();
    }
  );

  // Reset seluruh antrian dan penomorannya
  resetButton.addEventListener("click", () => {
    const confirmed = window.confirm(
      "Reset seluruh tiket antrian? Tindakan ini tidak bisa dibatalkan."
    );

    if (!confirmed) return;

    saveTickets([]);

    localStorage.setItem(
      STORAGE_KEYS.counters,
      JSON.stringify({})
    );

    if (ticketMessage) {
      ticketMessage.textContent =
        "Tiket manual akan dimulai kembali dari nomor awal.";
    }

    resetMessage.textContent =
      "Seluruh antrian berhasil direset.";

    renderTickets();
    renderServices();
  });

  // Menampilkan data ketika halaman dibuka
  renderServices();
  renderTicketServices();
  renderTickets();
}