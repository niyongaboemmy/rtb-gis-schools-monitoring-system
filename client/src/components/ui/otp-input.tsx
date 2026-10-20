import * as React from "react";
import { cn } from "../../lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  /** Fired when the last box is filled, so the form can auto-submit. */
  onComplete?: (value: string) => void;
  /** Focus the first empty box on mount (default true). */
  autoFocus?: boolean;
  /** Accessible name for the group, e.g. "Code from your authenticator app". */
  label?: string;
}

/**
 * Segmented numeric code entry. Digits are held as one string; the boxes are
 * a presentation detail, which keeps paste, backspace and arrow keys simple.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  onComplete,
  autoFocus = true,
  label = "Verification code",
}: OtpInputProps) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);

  React.useEffect(() => {
    if (autoFocus) refs.current[Math.min(value.length, length - 1)]?.focus();
    // Mount only — refocusing on every keystroke would fight the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const commit = (next: string) => {
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  const handleChange = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;

    // Typing one digit advances; pasting several fills forward from here.
    const next = (
      value.slice(0, index) +
      digits +
      value.slice(index + digits.length)
    ).slice(0, length);

    commit(next);
    refs.current[Math.min(index + digits.length, length - 1)]?.focus();
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      // Clear this box if filled, otherwise step back and clear that one.
      const target = value[index] ? index : index - 1;
      if (target < 0) return;
      commit(value.slice(0, target) + value.slice(target + 1));
      refs.current[target]?.focus();
    } else if (e.key === "ArrowLeft" && index > 0) {
      refs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!digits) return;
    commit(digits.slice(0, length));
    refs.current[Math.min(digits.length, length - 1)]?.focus();
  };

  return (
    <div className="flex justify-between gap-2" onPaste={handlePaste} role="group" aria-label={label}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          aria-label={`Digit ${index + 1} of ${length}`}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          value={value[index] ?? ""}
          disabled={disabled}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-12 sm:h-13 w-full max-w-13 min-w-0 rounded-xl border border-gray-300 dark:border-white/20",
            "bg-background dark:bg-white/[0.03] text-center text-lg font-semibold tabular-nums text-foreground dark:text-white",
            "transition-[border-color,box-shadow,transform] outline-none hover:border-gray-400 dark:hover:border-white/30",
            "focus:border-primary dark:focus:border-primary focus:ring-4 focus:ring-primary/15 focus:-translate-y-0.5",
            "disabled:opacity-50",
            value[index] && "border-primary/60 dark:border-primary/60 animate-[otp-pop_160ms_ease-out]",
          )}
        />
      ))}
    </div>
  );
}
