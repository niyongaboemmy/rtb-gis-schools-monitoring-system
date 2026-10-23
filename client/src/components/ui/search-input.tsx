import * as React from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { fieldShell } from "./field-styles";
import { motion, AnimatePresence } from "framer-motion";

interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSearch?: (value: string) => void;
  onClear?: () => void;
  isLoading?: boolean;
  containerClassName?: string;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      containerClassName,
      onSearch,
      onClear,
      isLoading,
      value,
      onChange,
      ...props
    },
    ref,
  ) => {
    const hasValue = value && value.toString().length > 0;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && onSearch) {
        onSearch(value as string);
      }
      if (props.onKeyDown) props.onKeyDown(e);
    };

    return (
      <div className={cn("relative group w-full", containerClassName)}>
        {/* The pill carries the field surface; the input inside is bare. */}
        <div className={cn("relative flex h-11 w-full items-center overflow-hidden rounded-full", fieldShell)}>
          <div className="pl-4 flex items-center justify-center pointer-events-none">
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-muted-foreground transition-colors duration-200 group-focus-within:text-primary" />
            )}
          </div>

          <input
            ref={ref}
            type="text"
            {...props}
            className={cn(
              "h-full min-w-0 flex-1 bg-transparent px-3 text-base outline-none placeholder:text-slate-400 sm:text-sm dark:placeholder:text-white/25",
              className,
            )}
            value={value}
            onChange={onChange}
            onKeyDown={handleKeyDown}
          />

          <AnimatePresence>
            {hasValue && !isLoading && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="pr-2"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-full hover:bg-muted"
                  aria-label="Clear search"
                  onClick={onClear}
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {onSearch && (
            <div className="pr-1">
              <Button
                type="button"
                size="sm"
                onClick={() => onSearch(value as string)}
                disabled={isLoading || !hasValue}
                className={cn(
                  "rounded-full h-9 px-5 text-[10px] font-black uppercase tracking-widest transition-all shadow-none",
                  hasValue
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "bg-muted text-muted-foreground cursor-not-allowed",
                )}
              >
                Search
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  },
);

SearchInput.displayName = "SearchInput";
