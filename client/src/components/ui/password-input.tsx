import * as React from "react";
import { cn } from "../../lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { authInputClass } from "../auth/auth-styles";
import { FieldIcon } from "../auth/AuthInput";
import { fieldSurface } from "./field-styles";

export type PasswordInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  /** Optional leading icon, e.g. <Lock /> on the sign-in screens. */
  leadingIcon?: React.ReactNode;
  /** `auth` (default): the sign-in screens' blue field. `app`: the in-app field surface. */
  appearance?: "auth" | "app";
};

/** Password field with a show/hide toggle and a Caps Lock warning. */
const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, onKeyUp, onBlur, leadingIcon, appearance = "auth", ...props }, ref) => {
    const app = appearance === "app";
    const [showPassword, setShowPassword] = React.useState(false);
    const [capsLock, setCapsLock] = React.useState(false);

    return (
      <div className="space-y-1.5">
        <div className="group relative">
          {leadingIcon && <FieldIcon>{leadingIcon}</FieldIcon>}
          <input
            type={showPassword ? "text" : "password"}
            className={cn(
              app ? cn("flex h-11 w-full rounded-xl px-4 text-base sm:text-sm", fieldSurface) : authInputClass,
              "pr-12",
              leadingIcon && "pl-11",
              className,
            )}
            ref={ref}
            onKeyUp={(e) => {
              setCapsLock(e.getModifierState?.("CapsLock") ?? false);
              onKeyUp?.(e);
            }}
            onBlur={(e) => {
              setCapsLock(false);
              onBlur?.(e);
            }}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className={cn(
              "absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              app
                ? "text-muted-foreground hover:bg-accent hover:text-foreground"
                : "text-primary/55 dark:text-blue-400/55 hover:text-primary dark:hover:text-blue-400 hover:bg-primary/8 dark:hover:bg-blue-400/10",
            )}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {capsLock && (
          <p className="text-xs font-medium text-warning" role="status">
            Caps Lock is on
          </p>
        )}
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
