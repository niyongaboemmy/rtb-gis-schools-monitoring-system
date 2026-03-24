import * as React from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";
import { Input } from "./input";
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
    const [isFocused, setIsFocused] = React.useState(false);
    const hasValue = value && value.toString().length > 0;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && onSearch) {
        onSearch(value as string);
      }
      if (props.onKeyDown) props.onKeyDown(e);
    };

    return (
      <div className={cn("relative group w-full", containerClassName)}>
        <div
          className={cn(
            "relative flex items-center w-full transition-all duration-300 rounded-full border border-gray-300/60 dark:border-border bg-background/40 backdrop-blur-md overflow-hidden",
            isFocused
              ? "border-primary/40 ring-4 ring-primary/5 bg-background/60"
              : "hover:border-border/20",
          )}
        >
          <div className="pl-4 flex items-center justify-center pointer-events-none">
            {isLoading ? (
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            ) : (
              <Search
                className={cn(
                  "w-4 h-4 transition-colors duration-300",
                  isFocused ? "text-primary" : "text-muted-foreground",
                )}
              />
            )}
          </div>

          <Input
            ref={ref}
            type="text"
            className={cn(
              "flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 h-11 text-sm placeholder:text-muted-foreground/50",
              className,
            )}
            value={value}
            onChange={onChange}
            onFocus={(e) => {
              setIsFocused(true);
              if (props.onFocus) props.onFocus(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              if (props.onBlur) props.onBlur(e);
            }}
            onKeyDown={handleKeyDown}
            {...props}
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
