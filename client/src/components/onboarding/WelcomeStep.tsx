import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Plus } from "lucide-react";

interface WelcomeStepProps {
  onNext: () => void;
  isFirstTime?: boolean;
  onCancel?: () => void;
}

export function WelcomeStep({ onNext, isFirstTime = true, onCancel }: WelcomeStepProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="flex flex-col items-center text-center max-w-lg mx-auto py-12"
    >
      {/* Animated Logo */}
      <motion.div 
        variants={itemVariants}
        className="mb-8"
        whileHover={{ scale: 1.05 }}
      >
        <div className="h-24 w-24 bg-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/20 relative overflow-hidden">
           <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
           <span className="text-white text-6xl font-display font-bold relative z-10">C</span>
           {/* Decorative wave/pulse rings */}
           <div className="absolute inset-0 border-2 border-white/20 rounded-2xl scale-125 animate-pulse" />
        </div>
      </motion.div>

      <motion.h1 
        variants={itemVariants}
        className="text-4xl font-bold tracking-tight mb-4"
      >
        Welcome to <span className="font-masthead text-5xl">Cronkite</span>
      </motion.h1>

      <motion.p 
        variants={itemVariants}
        className="text-xl text-muted-foreground mb-2"
      >
        Your intelligent, personalized news reader.
      </motion.p>
      
      <motion.p 
        variants={itemVariants}
        className="text-lg text-muted-foreground/60 italic mb-8 font-serif"
      >
        "And that's the way it is." — Walter Cronkite
      </motion.p>

      {/* Reset Warning - only show for returning users */}
      {!isFirstTime && (
        <motion.div 
          variants={itemVariants}
          className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 mb-8 text-left"
        >
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                This will reset your feeds
              </p>
              <p className="text-amber-700 dark:text-amber-300/80">
                Completing this setup will replace all your current feeds and articles with a fresh selection.
              </p>
              <p className="text-amber-600 dark:text-amber-400/70 mt-2 flex items-center gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                <span>To add feeds without resetting, use the <strong>Add Feed</strong> button in the main interface instead.</span>
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
          Let's set up your feed in under 2 minutes
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!isFirstTime && onCancel && (
            <Button 
              variant="outline"
              size="lg" 
              onClick={onCancel}
              className="w-full sm:w-auto px-8 h-14 text-lg rounded-xl"
            >
              Cancel
            </Button>
          )}
          <Button 
            size="lg" 
            onClick={onNext}
            className="w-full sm:w-auto px-12 h-14 text-lg rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all bg-primary hover:bg-primary/90"
          >
            Get Started
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
