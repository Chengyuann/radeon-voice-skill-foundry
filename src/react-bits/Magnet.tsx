import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import type { PointerEvent, ReactNode } from "react";

type MagnetProps = {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  strength?: number;
};

export function Magnet({
  children,
  className = "",
  disabled = false,
  strength = 14
}: MagnetProps) {
  const reduceMotion = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 180, damping: 18, mass: 0.35 });
  const springY = useSpring(y, { stiffness: 180, damping: 18, mass: 0.35 });

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || reduceMotion || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    x.set(((event.clientX - bounds.left) / bounds.width - 0.5) * strength);
    y.set(((event.clientY - bounds.top) / bounds.height - 0.5) * strength);
  };

  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      className={className}
      style={{ x: springX, y: springY }}
      onPointerMove={move}
      onPointerLeave={reset}
    >
      {children}
    </motion.div>
  );
}
