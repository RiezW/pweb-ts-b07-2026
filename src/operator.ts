import { requireLogin } from "./auth.js";
import {
  clearSession,
  getServices,
  getSession,
  getTickets,
  saveTickets
} from "./storage.js";
import { STORAGE_KEYS } from "./types.js";

const APP_VERSION = "v3";

// Auth guard: wajib login, jika belum diarahkan ke login.html
const session = requireLogin();

// Tipe diambil dari storage.ts agar selalu sinkron dengan data yang disimpan
type Service = ReturnType<typeof getServices>[number];
type Ticket = ReturnType<typeof getTickets>[number];

const userName = document.querySelector<HTMLSpanElement>("#user-name");
const logoutButton = document.querySelector<HTMLButtonElement>("#logout-button");
const soundToggle = document.querySelector<HTMLButtonElement>("#sound-toggle");
const soundStatus = document.querySelector<HTMLParagraphElement>("#sound-status");
const grid = document.querySelector<HTMLDivElement>("#operator-grid");

// Semakin kecil angkanya, semakin didahulukan
const PRIORITY_RANK: Record<string, number> = {
  vip: 0,
  disabilitas: 1,
  lansia: 2,
  normal: 3
};

// ===============================================================
// SUARA PANGGILAN
// Bunyi "ting-tong" (Web Audio, cadangan: file WAV buatan sendiri)
// lalu suara bicara (Web Speech API). Semua native, tanpa library.
// ===============================================================

const SOUND_KEY = "hospital_operator_sound";

let audioContext: AudioContext | null = null;
let chimeUrl: string | null = null;
let chimeAudio: HTMLAudioElement | null = null;
let announceToken = 0;

// Disimpan di variabel agar tidak dibersihkan browser sebelum selesai bicara
let currentUtterance: SpeechSynthesisUtterance | null = null;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

function setSoundOn(on: boolean): void {
  localStorage.setItem(SOUND_KEY, on ? "on" : "off");
}

function updateSoundToggle(): void {
  if (!soundToggle) return;
  soundToggle.textContent = isSoundOn() ? "🔊 Suara: Aktif" : "🔇 Suara: Mati";
}

// Status suara ditampilkan di halaman agar mudah mencari penyebab jika diam
function setSoundStatus(text: string, isError = false): void {
  if (!soundStatus) return;
  soundStatus.textContent = text;
  soundStatus.className = isError
    ? "op-sound-status error"
    : "op-sound-status";
}

// Hentikan semua suara yang sedang atau akan diputar
function stopAllSound(): void {
  announceToken++;

  window.speechSynthesis?.cancel();

  if (chimeAudio) {
    chimeAudio.pause();
    chimeAudio = null;
  }

  if (audioContext && audioContext.state === "running") {
    void audioContext.suspend();
  }
}

// Jalur 1: Web Audio API
async function playChimeWebAudio(): Promise<boolean> {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
    }

    const ctx = audioContext;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    if (ctx.state !== "running") {
      return false;
    }

    const start = ctx.currentTime;

    [880, 659.25].forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const t0 = start + index * 0.35;

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.4, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(t0);
      oscillator.stop(t0 + 0.65);
    });

    await wait(800);
    return true;
  } catch {
    return false;
  }
}

// Membuat file WAV "ting-tong" langsung di memori (untuk jalur cadangan)
function getChimeUrl(): string {
  if (chimeUrl) return chimeUrl;

  const sampleRate = 22050;
  const total = Math.floor(sampleRate * 1.1);
  const samples = new Int16Array(total);

  const notes = [
    { frequency: 880, start: 0 },
    { frequency: 659.25, start: 0.35 }
  ];

  for (const note of notes) {
    const begin = Math.floor(note.start * sampleRate);
    const length = Math.floor(0.6 * sampleRate);

    for (let i = 0; i < length && begin + i < total; i++) {
      const t = i / sampleRate;
      const envelope = Math.min(1, t / 0.02) * Math.exp(-4 * t);
      const value = Math.sin(2 * Math.PI * note.frequency * t) * envelope * 0.4;
      samples[begin + i] += Math.round(value * 32767);
    }
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeText = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i] ?? 0, true);
  }

  chimeUrl = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  return chimeUrl;
}

// Jalur 2: elemen <audio> biasa
async function playChimeFallback(): Promise<boolean> {
  try {
    const audio = new Audio(getChimeUrl());
    chimeAudio = audio;
    audio.volume = 1;
    await audio.play();
    await wait(1100);
    return true;
  } catch {
    return false;
  }
}

async function playChime(): Promise<boolean> {
  if (await playChimeWebAudio()) return true;
  return playChimeFallback();
}

// Daftar suara dimuat asinkron oleh browser, jadi ditunggu sebentar
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve([]);
      return;
    }

    const synth = window.speechSynthesis;
    const voices = synth.getVoices();

    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    const timer = window.setTimeout(() => resolve(synth.getVoices()), 800);

    synth.addEventListener(
      "voiceschanged",
      () => {
        window.clearTimeout(timer);
        resolve(synth.getVoices());
      },
      { once: true }
    );
  });
}

// Pilih suara: Indonesia dulu, kalau tidak ada pakai suara bawaan browser
function pickVoice(
  voices: SpeechSynthesisVoice[]
): SpeechSynthesisVoice | undefined {
  const indonesian = voices.find((voice) =>
    voice.lang.toLowerCase().replace("_", "-").startsWith("id")
  );

  return indonesian ?? voices.find((voice) => voice.default) ?? voices[0];
}

async function speak(text: string, token: number): Promise<void> {
  const voices = await loadVoices();

  if (token !== announceToken || !isSoundOn()) return;

  if (voices.length === 0) {
    setSoundStatus(
      "Bunyi ting-tong diputar. Suara bicara tidak tersedia di browser ini."
    );
    return;
  }

  const synth = window.speechSynthesis;

  if (synth.speaking || synth.pending) {
    synth.cancel();
  }

  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(voices);

  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }

  utterance.rate = 0.9;
  utterance.volume = 1;

  utterance.onstart = () => {
    setSoundStatus(
      voice
        ? `Memutar suara: ${voice.name} (${voice.lang})`
        : "Memutar suara..."
    );
  };
  utterance.onend = () => {
    setSoundStatus("Selesai memutar panggilan.");
  };
  utterance.onerror = (event) => {
    setSoundStatus(`Suara bicara gagal diputar: ${event.error}`, true);
  };

  currentUtterance = utterance;

  // Jeda singkat setelah cancel() agar tidak diabaikan Chrome
  await wait(80);

  if (token !== announceToken || !isSoundOn()) return;

  synth.resume();
  synth.speak(utterance);
}

async function playCall(text: string): Promise<void> {
  // Pengaman utama: suara mati = tidak ada bunyi apa pun
  if (!isSoundOn()) return;

  const token = ++announceToken;

  setSoundStatus("Memutar bunyi panggilan...");
  const chimeOk = await playChime();

  if (token !== announceToken || !isSoundOn()) return;

  if (!chimeOk) {
    setSoundStatus(
      "Bunyi ting-tong gagal diputar. Cek volume dan izin suara browser.",
      true
    );
  }

  await speak(text, token);
}

// Semua pengumuman (termasuk "Ulangi") mengikuti saklar suara
async function announce(service: Service, ticket: Ticket): Promise<void> {
  if (!isSoundOn()) {
    setSoundStatus("Suara mati, panggilan tidak dibunyikan.");
    return;
  }

  await playCall(
    `Nomor antrian ${service.code}, ${ticket.number}. ` +
      `Silakan menuju ${service.name}.`
  );
}

// ===============================================================
// LOGIKA ANTRIAN
// ===============================================================

function formatTicketNumber(code: string, number: number): string {
  return `${code}-${String(number).padStart(3, "0")}`;
}

function priorityLabel(priority: string): string {
  if (priority === "vip") return "Prioritas VIP";
  return `Prioritas ${priority.charAt(0).toUpperCase()}${priority.slice(1)}`;
}

// Tiket menunggu pada satu layanan.
// Urutan: tiket biasa dulu (prioritas lalu nomor), tiket yang pernah
// dilewati ada di akhir antrian (urut waktu dilewati).
function getWaitingTickets(tickets: Ticket[], serviceId: string): Ticket[] {
  return tickets
    .filter((t) => t.serviceId === serviceId && t.status === "waiting")
    .sort((a, b) => {
      const aSkipped = Boolean(a.skippedAt);
      const bSkipped = Boolean(b.skippedAt);

      if (aSkipped !== bSkipped) {
        return aSkipped ? 1 : -1;
      }

      if (aSkipped && bSkipped) {
        return (a.skippedAt ?? "").localeCompare(b.skippedAt ?? "");
      }

      const rankA = PRIORITY_RANK[a.priority] ?? 99;
      const rankB = PRIORITY_RANK[b.priority] ?? 99;
      return rankA !== rankB ? rankA - rankB : a.number - b.number;
    });
}

function getCalledTicket(
  tickets: Ticket[],
  serviceId: string
): Ticket | undefined {
  return tickets.find(
    (t) => t.serviceId === serviceId && t.status === "called"
  );
}

// Panggil berikutnya: tiket aktif sebelumnya -> Selesai, tiket berikutnya -> Dipanggil
function callNext(service: Service): void {
  const tickets = getTickets();
  const next = getWaitingTickets(tickets, service.id)[0];
  if (!next) return;

  const updated = tickets.map((t) => {
    if (t.serviceId === service.id && t.status === "called") {
      return { ...t, status: "done" as const };
    }
    if (t.id === next.id) {
      return { ...t, status: "called" as const };
    }
    return t;
  });

  saveTickets(updated);
  render();
  void announce(service, next);
}

// Selesai: tiket yang sedang dipanggil -> Selesai
function finishCurrent(serviceId: string): void {
  const updated = getTickets().map((t) =>
    t.serviceId === serviceId && t.status === "called"
      ? { ...t, status: "done" as const }
      : t
  );
  saveTickets(updated);
  render();
}

// Lewati: tiket yang tidak hadir dipindahkan ke akhir antrian
function skipCurrent(serviceId: string): void {
  const updated = getTickets().map((t) =>
    t.serviceId === serviceId && t.status === "called"
      ? {
          ...t,
          status: "waiting" as const,
          skippedAt: new Date().toISOString()
        }
      : t
  );
  saveTickets(updated);
  render();
}

// Ulangi pengumuman untuk tiket yang sedang dipanggil
function replayCall(service: Service): void {
  const called = getCalledTicket(getTickets(), service.id);
  if (!called) return;
  void announce(service, called);
}

// ===============================================================
// TAMPILAN
// ===============================================================

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  text = ""
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function createButton(
  label: string,
  className: string,
  disabled: boolean,
  onClick: () => void
): HTMLButtonElement {
  const button = createElement("button", className, label);
  button.type = "button";
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function createInfoBlock(
  title: string,
  value: string,
  valueClass: string,
  subtitle?: string,
  extra?: HTMLElement
): HTMLDivElement {
  const block = createElement("div", "op-block");
  block.append(
    createElement("span", "op-label", title),
    createElement("strong", `op-number ${valueClass}`, value)
  );
  if (subtitle) {
    block.append(createElement("small", "op-sub", subtitle));
  }
  if (extra) {
    block.append(extra);
  }
  return block;
}

function createServiceCard(service: Service, tickets: Ticket[]): HTMLElement {
  const waiting = getWaitingTickets(tickets, service.id);
  const called = getCalledTicket(tickets, service.id);
  const next = waiting[0];

  const card = createElement("article", "op-card");

  const header = createElement("div", "op-card-header");
  header.append(
    createElement("h2", "op-service-name", service.name.toUpperCase()),
    createElement("span", "op-waiting", `${waiting.length} menunggu`)
  );

  const soundOn = isSoundOn();

  // Tombol ulangi panggilan kini ikut mati (disabled) jika suara dimatikan
  const replayButton = called
    ? createButton(
        soundOn ? "🔊 Ulangi panggilan" : "🔇 Suara mati",
        "op-replay",
        !soundOn,
        () => replayCall(service)
      )
    : undefined;

  const nextSubtitle = next
    ? next.skippedAt
      ? `${priorityLabel(next.priority)} • Sempat dilewati`
      : priorityLabel(next.priority)
    : undefined;

  const info = createElement("div", "op-info");
  info.append(
    createInfoBlock(
      "Sedang dipanggil",
      called ? formatTicketNumber(service.code, called.number) : "-",
      "current",
      undefined,
      replayButton
    ),
    createInfoBlock(
      "Berikutnya",
      next ? formatTicketNumber(service.code, next.number) : "-",
      "next",
      nextSubtitle
    )
  );

  const actions = createElement("div", "op-actions");
  actions.append(
    createButton("Panggil Berikutnya", "op-btn op-call", !next, () =>
      callNext(service)
    ),
    createButton("Selesai", "op-btn op-done", !called, () =>
      finishCurrent(service.id)
    ),
    createButton("Lewati", "op-btn op-skip", !called, () =>
      skipCurrent(service.id)
    )
  );

  card.append(header, info, actions);

  if (!next) {
    card.append(
      createElement(
        "p",
        "op-note",
        "Tidak ada tiket menunggu untuk jenis antrian ini."
      )
    );
  }

  return card;
}

function render(): void {
  if (!grid) return;

  const services = getServices().filter((service) => service.active);
  const tickets = getTickets();

  grid.replaceChildren();

  if (services.length === 0) {
    grid.append(
      createElement("p", "op-empty", "Belum ada jenis antrian yang aktif.")
    );
    return;
  }

  for (const service of services) {
    grid.append(createServiceCard(service, tickets));
  }
}

function init(): void {
  if (!userName || !logoutButton || !grid) return;

  userName.textContent = session.firstName;
  setSoundStatus(`Panel operator ${APP_VERSION} siap.`);

  // Muat daftar suara lebih awal
  void loadVoices();

  logoutButton.addEventListener("click", () => {
    stopAllSound();
    clearSession();
    window.location.href = "login.html";
  });

  if (soundToggle) {
    updateSoundToggle();
    soundToggle.addEventListener("click", () => {
      const next = !isSoundOn();
      setSoundOn(next);

      if (next) {
        setSoundStatus("Suara diaktifkan.");
      } else {
        stopAllSound();
        setSoundStatus("Suara dimatikan.");
      }

      updateSoundToggle();
      render();
    });
  }

  // Auth guard tambahan: halaman yang dipulihkan lewat tombol Back
  // (cache browser) tidak menjalankan script lagi, jadi sesi dicek ulang.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && !getSession()) {
      window.location.href = "login.html";
    }
  });

  // Sinkron otomatis bila tiket/layanan berubah dari tab lain
  window.addEventListener("storage", (event) => {
    // Logout dari tab lain -> tab ini ikut keluar
    if (
      (event.key === STORAGE_KEYS.auth || event.key === null) &&
      !getSession()
    ) {
      window.location.href = "login.html";
      return;
    }

    if (
      event.key === STORAGE_KEYS.tickets ||
      event.key === STORAGE_KEYS.services
    ) {
      render();
    }
  });

  render();
}

init();