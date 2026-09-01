import * as React from "react";
import { cn } from "../../lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  /** Fired when the last box is filled, so the form can auto-submit. */
  onComplete?: (value: string) => void;
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
}: OtpInputProps) {
  const refs = React.useRef<(HTMLInputElement | null)[]>([]);

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
    <div className="flex gap-2 sm:gap-3" onPaste={handlePaste}>
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          value={value[index] ?? ""}
          disabled={disabled}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={(e) => e.target.select()}
          className={cn(
            "h-14 w-full min-w-0 rounded-xl border border-input dark:border-blue-700/20",
            "bg-background/50 backdrop-blur-sm text-center text-xl font-black",
            "transition-all outline-none focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary",
            "disabled:opacity-50",
            value[index] && "border-primary/40",
          )}
        />
      ))}
    </div>
  );
}
