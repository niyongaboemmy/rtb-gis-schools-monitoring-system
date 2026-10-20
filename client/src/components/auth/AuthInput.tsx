import * as React from "react";
import { cn } from "../../lib/utils";
import { authInputClass } from "./auth-styles";

export interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Small leading icon (lucide); soft brand blue at rest, full blue while focused. */
  icon?: React.ReactNode;
}

/** Auth-screen text field with an optional leading icon. */
export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(
  ({ icon, className, ...props }, ref) => (
    <div className="group relative">
      {icon && <FieldIcon>{icon}</FieldIcon>}
      <input ref={ref} className={cn(authInputClass, icon && "pl-11", className)} {...props} />
    </div>
  ),
);
AuthInput.displayName = "AuthInput";

/** Leading-icon slot shared with PasswordInput. Place inside a `group` wrapper. */
export function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary/55 transition-colors duration-200 group-focus-within:text-primary dark:text-blue-400/55 dark:group-focus-within:text-blue-400 [&_svg]:h-4 [&_svg]:w-4"
    >
      {children}
    </span>
  );
}
