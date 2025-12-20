import { useEffect, useState } from "react";
import { motion } from "framer-motion";

export function Confetti() {
  const [pieces, setPieces] = useState<{ id: number; x: number; y: number; color: string; rotation: number }[]>([]);

  useEffect(() => {
    const colors = ["#4F46E5", "#F97316", "#10B981", "#EAB308", "#EC4899"];
    const newPieces = Array.from({ length: 50 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100, // percentage
      y: Math.random() * 100, // percentage
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
    }));
    setPieces(newPieces);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {pieces.map((piece) => (
        <motion.div
          key={piece.id}
          initial={{ y: -20, opacity: 1 }}
          animate={{ y: 500, opacity: 0, rotate: piece.rotation + 360 }}
          transition={{ duration: 2 + Math.random() * 2, ease: "easeOut" }}
          style={{
            position: "absolute",
            left: `${piece.x}%`,
            top: `${piece.y - 50}%`, // Start higher
            width: "8px",
            height: "8px",
            backgroundColor: piece.color,
            borderRadius: "2px",
          }}
        />
      ))}
    </div>
  );
}
