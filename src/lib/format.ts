/**
 * Deterministic French formatting helpers.
 * Intl output can differ between Node and browsers (narrow spaces, abbreviations),
 * which would break hydration — so dates and numbers are formatted by hand.
 */

/** Reference date of the demonstration dataset. */
export const DEMO_TODAY = "2026-09-24";

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];
const MONTHS_SHORT = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];
const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const WEEKDAYS_SHORT = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

const pad2 = (n: number) => String(n).padStart(2, "0");

function parts(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const time = iso.length > 10 ? iso.slice(11, 16) : "";
  return { y, m, d, time };
}

/** 24 septembre 2026 */
export function formatLong(iso: string) {
  const { y, m, d } = parts(iso);
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]} ${y}`;
}

/** 24 sept. 2026 */
export function formatShort(iso: string) {
  const { y, m, d } = parts(iso);
  return `${pad2(d)} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** 24/09/2026 */
export function formatNumeric(iso: string) {
  const { y, m, d } = parts(iso);
  return `${pad2(d)}/${pad2(m)}/${y}`;
}

/** Jeudi 24 septembre 2026 */
export function formatWeekday(iso: string) {
  const { y, m, d } = parts(iso);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[day]} ${formatLong(iso)}`;
}

/** 14:32 (empty when the value has no time part) */
export function formatTime(iso: string) {
  return parts(iso).time;
}

/** 24 septembre 2026 à 14:32 */
export function formatDateTime(iso: string) {
  const time = formatTime(iso);
  return time ? `${formatLong(iso)} à ${time}` : formatLong(iso);
}

/** Whole days from `from` to `to` (ISO dates). */
export function daysBetween(from: string, to: string) {
  const a = parts(from);
  const b = parts(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** Aujourd'hui · Dans 1 jour · En retard de 2 jours */
export function relativeDue(iso: string, today = DEMO_TODAY) {
  const n = daysBetween(today, iso);
  if (n === 0) return "Aujourd'hui";
  if (n > 0) return `Dans ${n} jour${n > 1 ? "s" : ""}`;
  return `En retard de ${-n} jour${n < -1 ? "s" : ""}`;
}

/** Adds days to an ISO date and returns an ISO date. */
export function addDays(iso: string, days: number) {
  const { y, m, d } = parts(iso);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

/** Adds calendar months to an ISO date (day clamped to the end of the month). */
export function addMonths(iso: string, months: number) {
  const { y, m, d } = parts(iso);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${pad2(nm)}-${pad2(Math.min(d, last))}`;
}

/** "09:30" → minutes since midnight. */
export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Minutes since midnight → "09:30". */
export function fromMinutes(total: number) {
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

/** "2 h", "1 h 30", "45 min" */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${pad2(m)}` : `${h} h`;
}

/** Monday of the week of an ISO date. */
export function startOfWeek(iso: string) {
  const { y, m, d } = parts(iso);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(iso, day === 0 ? -6 : 1 - day);
}

/** Lun. 5 oct. */
export function formatDayShort(iso: string) {
  const { y, m, d } = parts(iso);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS_SHORT[day]} ${d === 1 ? "1er" : d} ${MONTHS_SHORT[m - 1]}`;
}

/** octobre 2026 */
export function formatMonth(iso: string) {
  const { y, m } = parts(iso);
  return `${MONTHS[m - 1]} ${y}`;
}

/** 5 – 9 octobre 2026 (or 28 septembre – 2 octobre 2026) */
export function formatWeekRange(from: string, to: string) {
  const a = parts(from);
  const b = parts(to);
  if (a.m === b.m && a.y === b.y) return `${a.d} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  if (a.y === b.y) return `${a.d} ${MONTHS[a.m - 1]} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
  return `${formatLong(from)} – ${formatLong(to)}`;
}

/** 50 000 (non-breaking thousands separator) */
export function formatNumber(value: number) {
  const [int, dec] = String(value).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return dec ? `${grouped},${dec}` : grouped;
}

/** 1 projet · 3 projets */
export function plural(n: number, singular: string, pluralForm = `${singular}s`) {
  return n > 1 ? pluralForm : singular;
}

/** Current wall-clock time (HH:MM) — only call from event handlers. */
export function nowTime() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Human readable file size in French notation. */
export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Triggers a client-side download of a text payload. */
export function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Serialises rows to a semicolon separated CSV (Excel FR friendly). */
export function toCsv(rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(escape).join(";")).join("\n");
}
