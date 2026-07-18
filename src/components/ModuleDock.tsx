import {
  AudioWaveform,
  BrainCircuit,
  Braces,
  ShieldCheck
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

export type WorkbenchModule = "voice" | "policy" | "proof" | "memory";

type ModuleDockProps = {
  active?: WorkbenchModule;
  onSelect: (module: WorkbenchModule) => void;
  compact?: boolean;
};

const modules = [
  {
    id: "voice",
    label: "Voice",
    detail: "Capture",
    icon: AudioWaveform
  },
  {
    id: "policy",
    label: "Policy",
    detail: "Compile",
    icon: Braces
  },
  {
    id: "proof",
    label: "Proof",
    detail: "Verify",
    icon: ShieldCheck
  },
  {
    id: "memory",
    label: "Memory",
    detail: "Reuse",
    icon: BrainCircuit
  }
] satisfies Array<{
  id: WorkbenchModule;
  label: string;
  detail: string;
  icon: typeof AudioWaveform;
}>;

export function ModuleDock({
  active,
  onSelect,
  compact = false
}: ModuleDockProps) {
  const reduceMotion = useReducedMotion();

  return (
    <nav
      className={`module-dock ${compact ? "module-dock-compact" : ""}`}
      aria-label="Workbench modules"
    >
      <span className="module-dock-caption">
        {active ? "Switch module" : "Open module"}
      </span>
      <div className="module-dock-track">
        {modules.map((module, index) => {
          const Icon = module.icon;
          const isActive = active === module.id;

          return (
            <motion.button
              className={`module-dock-item ${
                isActive ? "module-dock-item-active" : ""
              }`}
              type="button"
              key={module.id}
              aria-label={module.label}
              aria-current={isActive ? "page" : undefined}
              onClick={() => onSelect(module.id)}
              whileHover={reduceMotion ? undefined : { y: -6, scale: 1.06 }}
              whileTap={reduceMotion ? undefined : { scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
            >
              {isActive ? (
                <motion.span
                  className="module-dock-active"
                  layoutId="module-dock-active"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              ) : null}
              <span className="module-dock-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="module-dock-icon">
                <Icon size={compact ? 17 : 19} strokeWidth={1.8} />
              </span>
              <span className="module-dock-copy">
                <strong>{module.label}</strong>
                <small>{module.detail}</small>
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
