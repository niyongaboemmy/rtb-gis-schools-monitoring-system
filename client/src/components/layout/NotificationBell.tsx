import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Bell, CheckCheck, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { formatRelative } from "../../lib/format";
import { useNotifications, type AppNotification } from "./notifications";
import { useFocusTrap } from "./useFocusTrap";

const TONE: Record<AppNotification["tone"], { icon: typeof Info; cls: string }> = {
  success: { icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400" },
  danger: { icon: AlertTriangle, cls: "text-rose-600 dark:text-rose-400" },
  warning: { icon: XCircle, cls: "text-amber-600 dark:text-amber-400" },
  info: { icon: Info, cls: "text-primary" },
};

/** Header bell with unread count and a dropdown list (WS3.11). */
export function NotificationBell() {
  const { items, markRead, markAllRead, clear } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const unread = items.filter((i) => !i.read).length;
  useFocusTrap(panelRef, open, () => setOpen(false));

  return (
    <div className="relative" data-tour="notifications">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative flex items-center justify-center w-9 h-9 rounded-full text-muted-foreground border border-transparent hover:text-foreground hover:bg-accent hover:border-border/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="w-4 h-4" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-[10px] font-bold leading-4 text-primary-foreground text-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setOpen(false)} />
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-label="Notifications"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="fixed right-2 left-2 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-11 sm:w-96 z-50 rounded-xl border border-border bg-background shadow-xl"
            >
              <div className="flex items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
                <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={markAllRead}
                    disabled={!unread}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Mark all read
                  </button>
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={clear}
                      className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  You are all caught up. Updates on your reports will appear here.
                </p>
              ) : (
                <ul className="max-h-[60vh] overflow-y-auto divide-y divide-border/40">
                  {items.map((n) => {
                    const T = TONE[n.tone];
                    const content = (
                      <>
                        <T.icon className={cn("mt-0.5 h-4 w-4 shrink-0", T.cls)} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className={cn("text-sm text-foreground", !n.read && "font-semibold")}>{n.title}</span>
                            {!n.read && <span className="h-2 w-2 rounded-full bg-primary" aria-label="unread" />}
                          </span>
                          <span className="block text-xs text-muted-foreground">{n.body}</span>
                          <span className="block text-[11px] text-muted-foreground mt-0.5">{formatRelative(n.createdAt)}</span>
                        </span>
                      </>
                    );
                    const cls = "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-accent/60 focus-visible:outline-none focus-visible:bg-accent";
                    return (
                      <li key={n.id}>
                        {n.href ? (
                          <Link
                            to={n.href}
                            className={cls}
                            onClick={() => {
                              markRead(n.id);
                              setOpen(false);
                            }}
                          >
                            {content}
                          </Link>
                        ) : (
                          <button type="button" className={cls} onClick={() => markRead(n.id)}>
                            {content}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
