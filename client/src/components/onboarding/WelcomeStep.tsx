import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface WelcomeStepProps {
  onNext: () => void;
}

export function WelcomeStep({ onNext }: WelcomeStepProps) {
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
        className="text-4xl font-display font-bold tracking-tight mb-4"
      >
        Welcome to Cronkite
      </motion.h1>

      <motion.p 
        variants={itemVariants}
        className="text-xl text-muted-foreground mb-2"
      >
        Your intelligent, personalized news reader.
      </motion.p>
      
      <motion.p 
        variants={itemVariants}
        className="text-lg text-muted-foreground/60 italic mb-12 font-serif"
      >
        "And that's the way it is." — Walter Cronkite
      </motion.p>

      <motion.div variants={itemVariants}>
        <p className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
          Let's set up your feed in under 2 minutes
        </p>
        <Button 
          size="lg" 
          onClick={onNext}
          className="w-full sm:w-auto px-12 h-14 text-lg rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all bg-primary hover:bg-primary/90"
        >
          Get Started
        </Button>
      </motion.div>
    </motion.div>
  );
}
