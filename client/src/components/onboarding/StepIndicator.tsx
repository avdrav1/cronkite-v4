import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 mb-12">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <div key={step} className="flex items-center">
            {/* Connector Line */}
            {i > 0 && (
              <div 
                className={cn(
                  "w-8 h-0.5 mx-2 transition-colors duration-300",
                  step <= currentStep ? "bg-primary" : "bg-border"
                )}
              />
            )}
            
            {/* Step Dot */}
            <motion.div
              initial={false}
              animate={{
                backgroundColor: isActive || isCompleted ? "var(--primary)" : "transparent",
                borderColor: isActive || isCompleted ? "var(--primary)" : "var(--border)",
                scale: isActive ? 1.1 : 1,
              }}
              className={cn(
                "w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-colors duration-300",
                isActive || isCompleted ? "text-primary-foreground" : "text-muted-foreground"
              )}
            >
              {isCompleted ? "✓" : step}
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
