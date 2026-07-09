// ============================================
// Jarvis OS — Utility Functions
// ============================================

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names properly with Tailwind merge.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a date relative to now (e.g., "2 hours ago", "yesterday").
 */
export function relativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("de-DE", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Format a number with abbreviation (e.g., 1200 → "1.2k").
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toString();
}

/**
 * Generate a unique ID (simple for client-side use).
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Truncate text with ellipsis.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1) + "…";
}

/**
 * Get initials from a name string.
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Status color mapping for consistent UI.
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: "var(--success)",
    completed: "var(--accent)",
    paused: "var(--warning)",
    archived: "var(--fg-muted)",
    todo: "var(--fg-muted)",
    in_progress: "var(--info)",
    done: "var(--success)",
    cancelled: "var(--error)",
    not_started: "var(--fg-muted)",
    achieved: "var(--success)",
    abandoned: "var(--error)",
    urgent: "var(--error)",
    high: "var(--warning)",
    medium: "var(--info)",
    low: "var(--fg-muted)",
  };
  return colors[status] || "var(--fg-muted)";
}

/**
 * Priority label mapping.
 */
export function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
    urgent: "Urgent",
  };
  return labels[priority] || priority;
}
