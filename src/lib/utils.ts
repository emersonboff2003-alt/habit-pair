import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Fuso oficial usado pelo app (Brasília, UTC-3). */
export const APP_TIME_ZONE = "America/Sao_Paulo";

/**
 * Offset (em ms) entre UTC e o fuso informado num dado instante UTC.
 * Usado para converter "meia-noite local" em instante UTC correto.
 */
function getTimeZoneOffsetMs(timeZone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const value = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const hour = value("hour") === 24 ? 0 : value("hour");
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), hour, value("minute"), value("second"));
  return asUtc - utcMs;
}

/** Data "YYYY-MM-DD" de hoje no fuso informado. */
export function dateKeyInTimeZone(timeZone = APP_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Início do dia (meia-noite) no fuso informado, como instante ISO em UTC.
 * Evita que o "dia" seja calculado no fuso do servidor (UTC), o que fazia
 * registros noturnos caírem no dia errado para o usuário.
 */
export function startOfToday(timeZone = APP_TIME_ZONE): string {
  const [y, m, d] = dateKeyInTimeZone(timeZone).split("-").map(Number);
  const utcMidnightGuess = Date.UTC(y, m - 1, d);
  const offset = getTimeZoneOffsetMs(timeZone, utcMidnightGuess);
  return new Date(utcMidnightGuess - offset).toISOString();
}

/** Hora atual (0–23) no fuso informado. */
export function hourInTimeZone(timeZone = APP_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return hour === 24 ? 0 : hour;
}

/** Formata uma data ISO para pt-BR no fuso brasileiro (não no do servidor). */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/** Retorna a data de hoje como string no formato YYYY-MM-DD (fuso brasileiro). */
export function todayKey(): string {
  return dateKeyInTimeZone();
}

/** Iniciais de um nome para avatar. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
