import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, icon, rightIcon, ...props }, ref) => {
    return (
      <div className="relative w-full group">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none">
            {icon}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "flex h-11 w-full rounded-xl border border-gray-300/60 dark:border-white/30 bg-background/40 dark:bg-transparent backdrop-blur-md px-4 py-2 text-sm transition-all duration-300 placeholder:text-muted-foreground/40",
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/5 focus-visible:border-primary/40 focus:bg-background/60",
            "disabled:cursor-not-allowed disabled:opacity-50",
            icon && "pl-11",
            rightIcon && "pr-11",
            className,
          )}
          ref={ref}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground group-focus-within:text-primary transition-colors pointer-events-none">
            {rightIcon}
          </div>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
