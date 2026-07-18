import { motion, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";

export type StepperItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type StepperProps = {
  steps: StepperItem[];
  active: number;
};

export function Stepper({ steps, active }: StepperProps) {
  const reduceMotion = useReducedMotion();
  const progress = steps.length <= 1 ? 0 : active / (steps.length - 1);

  return (
    <nav className="bits-stepper" aria-label="Foundry progress">
      <div className="bits-step-track" aria-hidden="true">
        <motion.i
          initial={false}
          animate={{ scaleX: Math.min(1, Math.max(0, progress)) }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 95, damping: 18 }
          }
        />
      </div>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const state =
          index < active ? "complete" : index === active ? "active" : "pending";
        return (
          <motion.div
            className={`bits-step bits-step-${state}`}
            key={step.id}
            initial={false}
            animate={{ opacity: state === "pending" ? 0.62 : 1 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="bits-step-icon"
              animate={
                state === "active" && !reduceMotion
                  ? { scale: [1, 1.08, 1] }
                  : { scale: 1 }
              }
              transition={
                state === "active"
                  ? { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.2 }
              }
            >
              <Icon size={16} strokeWidth={1.8} />
            </motion.div>
            <span>{step.label}</span>
          </motion.div>
        );
      })}
    </nav>
  );
}
