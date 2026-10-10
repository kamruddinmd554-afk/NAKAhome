import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function inr(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase();
}

export function digitsPhone(raw: string) {
  return raw.replace(/\D/g, "").slice(-10);
}

export function formatInPhone(raw: string) {
  const d = digitsPhone(raw);
  if (d.length !== 10) return raw;
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

export function isValidInPhone(raw: string) {
  return /^[6-9]\d{9}$/.test(digitsPhone(raw));
}
