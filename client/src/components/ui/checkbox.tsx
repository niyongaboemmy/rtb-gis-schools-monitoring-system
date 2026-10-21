import { forwardRef, useEffect, useImperativeHandle, useRef, type InputHTMLAttributes } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "../../lib/utils";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "size"> {
  /** Some — not all — of a group is selected (e.g. a "select page" header). */
  indeterminate?: boolean;
}

/**
 * Themed checkbox on a real <input type="checkbox"> (keyboard, forms and
 * screen readers behave natively); the box and tick are drawn on top so it
 * looks the same in every browser, in light and dark.
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, indeterminate = false, checked, disabled, ...rest },
  ref,
) {
  const inner = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inner.current as HTMLInputElement);
  useEffect(() => {
    if (inner.current) inner.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const on = !!checked || indeterminate;
  const Mark = indeterminate ? Minus : Check;
  return (
    <span className={cn("relative inline-flex h-4 w-4 shrink-0 align-middle", disabled && "opacity-50", className)}>
      <input
        ref={inner}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-checked={indeterminate ? "mixed" : undefined}
        className={cn(
          "peer absolute inset-0 m-0 h-full w-full cursor-pointer appearance-none rounded-[5px] border transition-[background-color,border-color,box-shadow] duration-150",
          "border-slate-300 bg-white hover:border-slate-400",
          "dark:border-white/20 dark:bg-white/[0.04] dark:hover:border-white/35",
          "checked:border-primary checked:bg-primary hover:checked:border-primary dark:checked:border-primary dark:checked:bg-primary",
          "indeterminate:border-primary indeterminate:bg-primary dark:indeterminate:border-primary dark:indeterminate:bg-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed",
        )}
        {...rest}
      />
      <Mark
        aria-hidden
        strokeWidth={3}
        className={cn(
          "pointer-events-none absolute inset-0 m-auto h-3 w-3 text-primary-foreground transition-[opacity,transform] duration-150",
          on ? "scale-100 opacity-100" : "scale-50 opacity-0",
        )}
      />
    </span>
  );
});
