import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type AnimatedContentProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  distance?: number;
};

export function AnimatedContent({
  children,
  className = "",
  delay = 0,
  distance = 18
}: AnimatedContentProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={
        reduceMotion
          ? false
          : {
              opacity: 0,
              y: distance,
              filter: "blur(5px)"
            }
      }
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{
        duration: 0.55,
        delay,
        ease: [0.16, 1, 0.3, 1]
      }}
    >
      {children}
    </motion.div>
  );
}
