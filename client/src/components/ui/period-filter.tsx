import { useState } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './button';
import { 
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfWeek, 
  startOfMonth, 
  startOfYear 
} from 'date-fns';

export type PeriodRange = {
  label: string;
  startDate: Date | null;
  endDate: Date | null;
  key: string;
};

interface PeriodFilterProps {
  onRangeChange: (range: PeriodRange) => void;
  className?: string;
}

const PREDEFINED_RANGES: PeriodRange[] = [
  { 
    label: 'Today', 
    key: 'today',
    startDate: startOfDay(new Date()), 
    endDate: endOfDay(new Date()) 
  },
  { 
    label: 'Yesterday', 
    key: 'yesterday',
    startDate: startOfDay(subDays(new Date(), 1)), 
    endDate: endOfDay(subDays(new Date(), 1)) 
  },
  { 
    label: 'This Week', 
    key: 'this_week',
    startDate: startOfWeek(new Date(), { weekStartsOn: 1 }), 
    endDate: endOfDay(new Date()) 
  },
  { 
    label: 'This Month', 
    key: 'this_month',
    startDate: startOfMonth(new Date()), 
    endDate: endOfDay(new Date()) 
  },
  { 
    label: 'This Year', 
    key: 'this_year',
    startDate: startOfYear(new Date()), 
    endDate: endOfDay(new Date()) 
  },
  { 
    label: 'All Time', 
    key: 'all_time',
    startDate: null, 
    endDate: null 
  },
];

export function PeriodFilter({ onRangeChange, className }: PeriodFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<PeriodRange>(PREDEFINED_RANGES[3]); // Default to This Month

  const handleSelect = (range: PeriodRange) => {
    setSelectedRange(range);
    onRangeChange(range);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-2xl h-11 px-5 border-border/10 bg-card/50 backdrop-blur-md flex items-center gap-3 font-black uppercase text-[10px] tracking-widest transition-all hover:bg-primary/5 active:scale-95 shadow-none"
      >
        <Calendar className="w-3.5 h-3.5 text-primary" />
        <span>{selectedRange.label}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-50" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute top-full mt-2 left-0 w-56 bg-card/90 backdrop-blur-xl border border-border/10 rounded-[25px] shadow-2xl z-50 overflow-hidden p-2">
            {PREDEFINED_RANGES.map((range) => (
              <button
                key={range.key}
                onClick={() => handleSelect(range)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                  selectedRange.key === range.key 
                    ? "bg-primary text-primary-foreground" 
                    : "text-muted-foreground hover:bg-primary/10 hover:text-primary"
                )}
              >
                {range.label}
                {selectedRange.key === range.key && <Check className="w-3 h-3" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
