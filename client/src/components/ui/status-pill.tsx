import type { ReactNode } from "react";
import { cn } from "../../lib/utils";
import { TONE_PILL, type Tone } from "./surfaces";

/** Small rounded status label with a dot; `pulse` for states that need attention. */
export function StatusPill({
  tone,
  pulse,
  dot = true,
  className,
  children,
}: {
  tone: Tone;
  pulse?: boolean;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const p = TONE_PILL[tone];
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium",
        p.box,
        className,
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
          {pulse && (
            <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:animate-none", p.dot)} />
          )}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", p.dot)} />
        </span>
      )}
      <span className="truncate">{children}</span>
    </span>
  );
}
