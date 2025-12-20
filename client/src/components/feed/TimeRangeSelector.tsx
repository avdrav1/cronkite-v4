import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TimeRangeSelectorProps {
  value: number;
  onChange: (days: number) => void;
}

const RANGES = [
  { label: "7d", value: 7, fullLabel: "Past 7 Days" },
  { label: "14d", value: 14, fullLabel: "Past 14 Days" },
  { label: "30d", value: 30, fullLabel: "Past 30 Days" },
  { label: "90d", value: 90, fullLabel: "Past 90 Days" },
];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center bg-muted/30 p-1 rounded-full border border-border/50 relative">
        {/* Active Background Pill */}
        <div className="absolute inset-0 p-1">
          <motion.div
            className="h-full bg-background rounded-full shadow-sm ring-1 ring-black/5 dark:ring-white/10"
            layoutId="time-range-pill"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            style={{
              width: `${100 / RANGES.length}%`,
              left: `${(RANGES.findIndex((r) => r.value === value) / RANGES.length) * 100}%`,
            }}
          />
        </div>

        {/* Labels */}
        {RANGES.map((range) => {
          const isActive = range.value === value;
          return (
            <button
              key={range.value}
              onClick={() => onChange(range.value)}
              className={cn(
                "relative z-10 flex-1 py-1.5 text-xs font-medium text-center transition-colors duration-200",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
              )}
            >
              <span className="md:hidden">{range.label}</span>
              <span className="hidden md:inline">{range.fullLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
