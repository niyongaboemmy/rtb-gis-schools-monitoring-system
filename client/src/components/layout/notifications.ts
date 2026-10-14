import { create } from "zustand";
import { label } from "../../lib/labels";

/**
 * In-app notifications (WS3.11). Fed by socket events in AppLayout and kept in
 * localStorage per user (server-side persistence is out of scope for now).
 */
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  /** In-app link, e.g. /reporting?report=<id> */
  href?: string;
  tone: "success" | "warning" | "info" | "danger";
  createdAt: string;
  read: boolean;
}

const MAX_ITEMS = 50;
const keyFor = (userId: string) => `rtb-notifications:${userId}`;

function load(userId: string): AppNotification[] {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    const parsed = raw ? (JSON.parse(raw) as AppNotification[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

function save(userId: string | null, items: AppNotification[]) {
  if (!userId) return;
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* storage full or blocked — keep in memory only */
  }
}

interface NotificationState {
  userId: string | null;
  items: AppNotification[];
  bind: (userId: string | null) => void;
  add: (n: Omit<AppNotification, "id" | "createdAt" | "read"> & { id?: string }) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotifications = create<NotificationState>((set, get) => ({
  userId: null,
  items: [],
  bind: (userId) => set({ userId, items: userId ? load(userId) : [] }),
  add: (n) => {
    const { userId, items } = get();
    const id = n.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (items.some((i) => i.id === id)) return;
    const next = [
      { ...n, id, createdAt: new Date().toISOString(), read: false },
      ...items,
    ].slice(0, MAX_ITEMS);
    save(userId, next);
    set({ items: next });
  },
  markRead: (id) => {
    const { userId, items } = get();
    const next = items.map((i) => (i.id === id ? { ...i, read: true } : i));
    save(userId, next);
    set({ items: next });
  },
  markAllRead: () => {
    const { userId, items } = get();
    const next = items.map((i) => ({ ...i, read: true }));
    save(userId, next);
    set({ items: next });
  },
  clear: () => {
    const { userId } = get();
    save(userId, []);
    set({ items: [] });
  },
}));

export interface ReportStatusChangedPayload {
  reportId: string;
  schoolId: string;
  newStatus: string;
  reportedBy?: string;
}

/** Plain-language notification for a report status change. */
export function describeStatusChange(
  p: ReportStatusChangedPayload,
  reportsPath: "/reports" | "/reporting",
): Omit<AppNotification, "createdAt" | "read"> {
  const status = label("reportStatus", p.newStatus);
  const tone: AppNotification["tone"] =
    p.newStatus === "SOLVED"
      ? "success"
      : p.newStatus === "NEED_INTERVENTION"
        ? "danger"
        : p.newStatus === "FAILED"
          ? "warning"
          : "info";
  const body =
    p.newStatus === "SOLVED"
      ? "Good news: the issue you reported has been resolved."
      : p.newStatus === "NEED_INTERVENTION"
        ? "Your report was reviewed and needs intervention. RTB will follow up."
        : p.newStatus === "FAILED"
          ? "Your report was closed without action. Open it to see the details."
          : `Your report is now "${status}".`;
  return {
    id: `status:${p.reportId}:${p.newStatus}`,
    title: `Report ${status.toLowerCase()}`,
    body,
    href: `${reportsPath}?report=${p.reportId}`,
    tone,
  };
}

export interface ReportAssignedPayload {
  reportId: string;
  schoolId: string;
  type?: string;
  fields?: string[];
}

/** Notification for a change request routed to the user's role (GIS analyst). */
export function describeAssignment(
  p: ReportAssignedPayload,
  reportsPath: "/reports" | "/reporting",
): Omit<AppNotification, "createdAt" | "read"> {
  const fields = (p.fields ?? [])
    .map((f) => f.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase())
    .join(", ");
  return {
    id: `assigned:${p.reportId}`,
    title: "New change request",
    body: fields
      ? `A school asked to change: ${fields}. Review and apply it.`
      : "A school sent a data change request for you to review.",
    href: `${reportsPath}?report=${p.reportId}`,
    tone: "info",
  };
}
