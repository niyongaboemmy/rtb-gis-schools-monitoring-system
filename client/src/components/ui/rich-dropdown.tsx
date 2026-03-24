import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "./input";

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
}

export const RichDropdown = ({
  options,
  value,
  onChange,
  placeholder = "Select option...",
  searchPlaceholder = "Filter results...",
  className,
  disabled,
}: RichDropdownProps) => {
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
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "flex h-11 w-full items-center justify-between border border-border/50 bg-background/40 backdrop-blur-md px-4 py-2 text-sm transition-all duration-300",
          "hover:border-primary/20 hover:bg-background/50 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/40",
          isOpen && "border-primary/40 ring-4 ring-primary/5 bg-background/60",
          disabled && "opacity-50 cursor-not-allowed",
          className ? "rounded-full" : "rounded-xl",
        )}
      >
        <span
          className={cn(
            "truncate",
            !selectedOption && "text-muted-foreground/50",
          )}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-300",
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
            className="absolute z-50 w-full rounded-2xl border border-border/10 bg-background/80 backdrop-blur-xl shadow-2xl p-2 overflow-hidden"
          >
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-100" />
              <Input
                autoFocus
                type="text"
                placeholder={searchPlaceholder}
                className="w-full bg-muted/30 border-none h-9 pl-9 pr-4 rounded-xl text-xs focus:ring-0 outline-none placeholder:text-muted-foreground/40"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
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
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] transition-colors",
                      value === option.value
                        ? "bg-primary/10 text-primary dark:text-white font-normal"
                        : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {option.icon}
                      <span>{option.label}</span>
                    </div>
                    {value === option.value && (
                      <Check className="h-3.5 w-3.5" />
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
