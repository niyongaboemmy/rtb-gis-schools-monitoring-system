import * as React from "react";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { ClipboardPaste } from "lucide-react";
import { cn } from "../../lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  /** Fired when the last digit lands, so the form can auto-submit. */
  onComplete?: (value: string) => void;
  /** Focus on mount (default true). */
  autoFocus?: boolean;
  /** Accessible name, e.g. "Code from your authenticator app". */
  label?: string;
  /** The code is being checked — slots shimmer and input is locked. */
  busy?: boolean;
  /** The last code was rejected — slots shake once and turn red until typing resumes. */
  invalid?: boolean;
}

/**
 * Segmented one-time-code entry.
 *
 * One real (visually hidden) input sits over the slots, so the browser's
 * one-time-code autofill, password managers, screen readers, IME and paste
 * all behave like a normal field; the slots are presentation only. Extras:
 * a focus ring that glides between slots, a blinking caret, digits that pop
 * in, 3·3 grouping, paste from anywhere on the page, a one-tap "Paste code"
 * button, auto-submit, a shimmer while verifying and a shake on rejection.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  onComplete,
  autoFocus = true,
  label = "Verification code",
  busy,
  invalid,
}: OtpInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [focused, setFocused] = React.useState(false);
  const [canPaste, setCanPaste] = React.useState(false);
  const reduce = useReducedMotion();
  const shake = useAnimationControls();
  const ringId = React.useId();
  const locked = disabled || busy;

  // Split 6 → 3·3, 8 → 4·4; other lengths stay in one row.
  const groupSize = length % 2 === 0 && length >= 6 ? length / 2 : length;

  const commit = (raw: string) => {
    const next = raw.replace(/\D/g, "").slice(0, length);
    if (next === value) return;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  React.useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
    setCanPaste(typeof navigator !== "undefined" && !!navigator.clipboard?.readText);
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shake + refocus on each rejection: when `invalid` turns on, and again
  // whenever a check (busy → idle) ends still invalid (same error twice).
  const prev = React.useRef({ busy, invalid });
  React.useEffect(() => {
    const was = prev.current;
    prev.current = { busy, invalid };
    if (!invalid || busy) return;
    if (was.invalid && !was.busy) return;
    if (!reduce) void shake.start({ x: [0, -10, 10, -6, 6, -2, 0], transition: { duration: 0.45 } });
    inputRef.current?.focus();
  }, [busy, invalid, reduce, shake]);

  // Paste a code from anywhere on the page (not into some other field).
  const commitRef = React.useRef(commit);
  commitRef.current = commit;
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (locked) return;
      const target = e.target as HTMLElement | null;
      const otherField =
        target &&
        target !== inputRef.current &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (otherField) return;
      const digits = e.clipboardData?.getData("text").replace(/\D/g, "") ?? "";
      if (!digits) return;
      e.preventDefault();
      commitRef.current(digits);
      inputRef.current?.focus();
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [locked]);

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (/\d/.test(text)) commit(text);
    } catch {
      /* permission denied — the user can still paste with the keyboard */
    }
    inputRef.current?.focus();
  };

  const full = value.length === length;
  const activeIndex = focused && !locked ? Math.min(value.length, length - 1) : -1;
  const showError = invalid && value.length === 0;

  const slot = (i: number) => {
    const char = value[i];
    const isActive = i === activeIndex;
    return (
      <div
        key={i}
        className={cn(
          "relative flex h-14 flex-1 min-w-0 max-w-14 items-center justify-center rounded-xl border text-xl font-semibold tabular-nums transition-colors duration-200",
          "border-gray-300 bg-white text-foreground",
          "dark:border-blue-400/20 dark:bg-blue-500/[0.06] dark:text-white",
          char && "border-primary/50 bg-primary/[0.04] dark:border-blue-400/45 dark:bg-blue-500/[0.1]",
          full && !busy && "border-primary dark:border-blue-400/70",
          showError && "border-destructive/70 bg-destructive/[0.04] dark:border-red-400/60 dark:bg-red-500/[0.06]",
          locked && !busy && "opacity-50",
        )}
      >
        {/* Verifying shimmer, staggered across the slots — drawn under the digit */}
        {busy && !reduce && (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-xl bg-primary/15 dark:bg-blue-400/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.09, ease: "easeInOut" }}
          />
        )}

        {/* Focus ring glides to the active slot */}
        {isActive && (
          <motion.span
            layoutId={ringId}
            className="absolute -inset-px rounded-xl border-2 border-primary dark:border-blue-400 shadow-[0_0_0_4px_hsl(var(--primary)/0.15)]"
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 35 }}
          />
        )}

        <AnimatePresence mode="popLayout" initial={false}>
          {char ? (
            <motion.span
              key={`${i}-${char}`}
              initial={reduce ? false : { y: 10, opacity: 0, scale: 0.6, filter: "blur(4px)" }}
              // Drop the filter once landed: a lingering filter layer blends
              // wrongly under the translucent shimmer in Chrome.
              animate={{ y: 0, opacity: 1, scale: 1, filter: "blur(0px)", transitionEnd: { filter: "none" } }}
              className="relative"
              exit={reduce ? undefined : { y: -6, opacity: 0, scale: 0.8, transition: { duration: 0.12 } }}
              transition={{ type: "spring", stiffness: 520, damping: 28 }}
            >
              {char}
            </motion.span>
          ) : isActive ? (
            <span className="h-6 w-0.5 rounded-full bg-primary dark:bg-blue-400 motion-safe:animate-[otp-caret_1.1s_ease-in-out_infinite]" />
          ) : null}
        </AnimatePresence>

      </div>
    );
  };

  const slots = Array.from({ length }, (_, i) => i);
  const groups = [slots.slice(0, groupSize), slots.slice(groupSize)].filter((g) => g.length);

  return (
    <div className="space-y-2">
      <motion.div animate={shake} className="relative">
        <div className="flex items-center justify-between gap-2 sm:gap-3" aria-hidden>
          {groups.map((g, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <span className="h-0.5 w-3 shrink-0 rounded-full bg-gray-300 dark:bg-blue-400/30" />}
              <div className="flex flex-1 justify-between gap-2">{g.map(slot)}</div>
            </React.Fragment>
          ))}
        </div>

        {/* The real field: transparent, covering the slots. */}
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          aria-label={label}
          aria-invalid={showError || undefined}
          aria-busy={busy || undefined}
          spellCheck={false}
          value={value}
          disabled={locked}
          onChange={(e) => commit(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          // Keep the caret at the end: slots fill strictly left to right.
          onSelect={(e) => {
            const el = e.currentTarget;
            if (el.selectionStart !== el.value.length) el.setSelectionRange(el.value.length, el.value.length);
          }}
          className="absolute inset-0 h-full w-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent disabled:cursor-not-allowed"
          style={{ fontSize: 16 /* stops iOS zooming on focus */ }}
        />
      </motion.div>

      <div className="flex h-6 items-center justify-center">
        <AnimatePresence>
          {canPaste && value.length === 0 && !locked && (
            <motion.button
              type="button"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              onClick={() => void pasteFromClipboard()}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground dark:text-blue-100/60 dark:hover:bg-blue-500/10 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
              Paste code
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
