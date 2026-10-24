import React, { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, MapPin, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { label } from "../../lib/labels";
import { formatNumber } from "../../lib/format";
import { EASE } from "../school-dashboard/tokens";

interface SchoolInfo {
  name?: string | null;
  code?: string | null;
  level?: string | null;
  type?: string | null;
  status?: string | null;
  province?: string | null;
  district?: string | null;
  sector?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
}

interface BasicInfoModalProps {
  school: SchoolInfo;
  onClose: () => void;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60";

const toNum = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const Fact: React.FC<{ term: string; children: React.ReactNode; className?: string }> = ({
  term,
  children,
  className,
}) => (
  <div className={cn("min-w-0", className)}>
    <dt className="text-[13px] text-slate-500 dark:text-white/50">{term}</dt>
    <dd className="mt-0.5 truncate text-[15px] text-slate-800 dark:text-white/90">
      {children}
    </dd>
  </div>
);

export const BasicInfoModal: React.FC<BasicInfoModalProps> = ({
  school,
  onClose,
}) => {
  const reduce = useReducedMotion();
  const titleId = useId();
  const [copied, setCopied] = useState(false);

  const lat = toNum(school.latitude);
  const lng = toNum(school.longitude);
  const coords =
    lat !== null && lng !== null
      ? `${formatNumber(lat, 6)}, ${formatNumber(lng, 6)}`
      : null;

  const place =
    [school.province, school.district, school.sector]
      .filter(Boolean)
      .join(" · ") || "Location unknown";

  const isActive = String(school.status || "active").toLowerCase() === "active";

  const copyCoords = () => {
    if (!coords || !navigator.clipboard) return;
    void navigator.clipboard.writeText(coords).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <motion.div
      className="absolute inset-0 z-100 flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: EASE }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative w-full max-w-md overflow-hidden p-5 sm:p-6",
          "rounded-t-3xl sm:rounded-3xl",
          "bg-white/60 dark:bg-[hsl(224_40%_7%)]/60 backdrop-blur-2xl backdrop-saturate-150",
          "ring-1 ring-white/40 dark:ring-white/10",
          "shadow-[0_20px_50px_-20px_rgba(15,23,42,0.45)]",
          "text-slate-800 dark:text-white",
        )}
        initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-900/15 dark:bg-white/20 sm:hidden" aria-hidden />

        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:text-blue-300">
            <MapPin className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id={titleId}
              className="wrap-break-word text-[17px] font-medium leading-snug text-slate-900 dark:text-white"
            >
              {school.name}
            </h2>
            <p className="mt-0.5 truncate text-[14px] text-slate-500 dark:text-white/55">
              {school.code ? (
                <span className="tabular-nums">{school.code}</span>
              ) : null}
              {school.code ? " · " : null}
              {place}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close school info"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors",
              "hover:bg-slate-900/5 hover:text-slate-800 dark:text-white/60 dark:hover:bg-white/8 dark:hover:text-white",
              focusRing,
            )}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3.5 border-t border-slate-900/8 pt-4 dark:border-white/10">
          <Fact term="School code">
            <span className="tabular-nums">{school.code || "—"}</span>
          </Fact>
          <Fact term="Level">{school.level || "—"}</Fact>
          <Fact term="Type">{label("schoolTypeShort", school.type)}</Fact>
          <Fact term="Status">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  isActive ? "bg-emerald-500" : "bg-amber-500",
                )}
                aria-hidden
              />
              {label("schoolStatus", school.status || "active")}
            </span>
          </Fact>
          <div className="col-span-2 min-w-0">
            <dt className="text-[13px] text-slate-500 dark:text-white/50">Coordinates</dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate rounded-full bg-slate-900/5 px-3 py-1.5 text-[15px] tabular-nums text-slate-700 dark:bg-white/6 dark:text-white/80">
                {coords ?? "—"}
              </span>
              {coords && (
                <button
                  type="button"
                  onClick={copyCoords}
                  aria-label={copied ? "Coordinates copied" : "Copy coordinates"}
                  title={copied ? "Copied" : "Copy coordinates"}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors",
                    "hover:bg-slate-900/5 hover:text-slate-800 dark:text-white/60 dark:hover:bg-white/8 dark:hover:text-white",
                    copied && "text-primary dark:text-blue-300",
                    focusRing,
                  )}
                >
                  {copied ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden />
                  )}
                </button>
              )}
            </dd>
          </div>
        </dl>
      </motion.div>
    </motion.div>
  );
};
