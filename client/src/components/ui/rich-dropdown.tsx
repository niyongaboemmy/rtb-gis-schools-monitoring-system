import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "./input";
import { fieldShell, menuSurface } from "./field-styles";

export interface DropdownOption {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

interface RichDropdownProps {
  options: DropdownOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  /** Id for the trigger, so a `<label htmlFor>` can name it. */
  id?: string;
  "aria-label"?: string;
  /**
   * `field` (default): a form field. `ghost`: inline text + chevron with a soft
   * hover tint, for pickers that sit inside a summary row or toolbar.
   */
  variant?: "field" | "ghost";
}

export const RichDropdown = ({
  options,
  value,
  onChange,
  placeholder = "Select option...",
  searchPlaceholder = "Filter results...",
  className,
  disabled,
  id,
  "aria-label": ariaLabel,
  variant = "field",
}: RichDropdownProps) => {
  const ghost = variant === "ghost";
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={cn("relative", ghost ? "w-max min-w-28 shrink-0" : "w-full", className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        id={id}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        data-open={isOpen}
        className={cn(
          ghost
            ? "-ml-2 flex h-8 w-max min-w-28 shrink-0 items-center justify-between gap-2 rounded-lg px-2.5 text-left text-[15px] text-foreground outline-none transition-colors hover:bg-slate-900/[0.04] focus-visible:ring-2 focus-visible:ring-ring data-[open=true]:bg-slate-900/[0.05] dark:hover:bg-white/[0.05] dark:data-[open=true]:bg-white/[0.07]"
            : cn(
                "flex h-11 w-full items-center justify-between gap-2 px-4 py-2 text-left text-base outline-none sm:text-sm",
                fieldShell,
                className ? "rounded-full" : "rounded-xl",
              ),
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <span
          className={cn(
            // Ghost pickers hug their label: short values (level names) show in full.
            ghost ? "whitespace-nowrap" : "truncate",
            !selectedOption && "text-muted-foreground/50",
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-300",
            ghost ? "h-3.5 w-3.5" : "h-4 w-4",
            isOpen && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn("absolute z-50 overflow-hidden p-2", ghost ? "left-0 w-56" : "w-full min-w-48", menuSurface)}
          >
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-100" />
              <Input
                autoFocus
                type="text"
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-9 w-full rounded-xl border-none bg-muted/50 pl-9 pr-4 text-base shadow-none outline-none placeholder:text-muted-foreground/50 hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:ring-0 sm:text-xs dark:bg-white/[0.04] dark:hover:bg-white/[0.04] dark:focus-visible:bg-white/[0.06]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="max-h-[240px] overflow-y-auto custom-scrollbar space-y-1">
              {filteredOptions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground/50 text-xs font-medium uppercase tracking-widest">
                  No matching results
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-[15px] transition-colors",
                      value === option.value
                        ? "bg-primary/10 text-primary dark:text-white font-normal"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2 text-left">
                      {option.icon}
                      <span className="min-w-0 wrap-break-word">{option.label}</span>
                    </div>
                    {value === option.value && (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
