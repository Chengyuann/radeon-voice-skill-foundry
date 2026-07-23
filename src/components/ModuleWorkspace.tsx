import {
  Activity,
  ArrowLeft,
  AudioWaveform,
  BrainCircuit,
  Braces,
  CheckCircle2,
  ShieldCheck
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import type { RuntimeInfo } from "../../shared/types";
import { ModuleDock, type WorkbenchModule } from "./ModuleDock";

type ModuleWorkspaceProps = {
  active: WorkbenchModule;
  runtime?: RuntimeInfo;
  status: "draft" | "compiled" | "verified" | "quarantined";
  error?: string;
  onDismissError: () => void;
  onBack: () => void;
  onSelect: (module: WorkbenchModule) => void;
  children: ReactNode;
};

const moduleMeta = {
  voice: {
    index: "01",
    eyebrow: "Private input stream",
    title: "Voice intake",
    description:
      "Bind the spoken SOP to acoustic evidence and an aligned action trace.",
    icon: AudioWaveform
  },
  policy: {
    index: "02",
    eyebrow: "Multi-turn policy compiler",
    title: "Policy forge",
    description:
      "Correct intent in plain language and preserve every parent-child revision.",
    icon: Braces
  },
  proof: {
    index: "03",
    eyebrow: "Adversarial sandbox",
    title: "Proof chamber",
    description:
      "Exercise unsafe paths, issue governance receipts and package the result.",
    icon: ShieldCheck
  },
  memory: {
    index: "04",
    eyebrow: "Durable local context",
    title: "Skill memory",
    description:
      "Retrieve policy evidence, reuse verified procedures and revalidate drift.",
    icon: BrainCircuit
  }
} satisfies Record<
  WorkbenchModule,
  {
    index: string;
    eyebrow: string;
    title: string;
    description: string;
    icon: typeof AudioWaveform;
  }
>;

export function ModuleWorkspace({
  active,
  runtime,
  status,
  error,
  onDismissError,
  onBack,
  onSelect,
  children
}: ModuleWorkspaceProps) {
  const reduceMotion = useReducedMotion();
  const meta = moduleMeta[active];
  const Icon = meta.icon;

  return (
    <main id="workbench" className="module-workspace">
      <div className="module-workspace-grid" aria-hidden="true" />
      <header className="module-workspace-head">
        <button className="cover-return" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          Cover
        </button>

        <div className="module-runtime">
          <span>
            <Activity size={13} />
            {runtime?.mode === "radeon" ? "Radeon runtime" : "Local runtime"}
          </span>
          <strong>{runtime?.gpu || "gfx1100 · 48 GB VRAM"}</strong>
          <span className={`module-status module-status-${status}`}>
            {status === "verified" ? <CheckCircle2 size={13} /> : null}
            {status}
          </span>
        </div>
      </header>

      <section className="module-intro">
        <motion.span
          className="module-watermark"
          key={meta.index}
          initial={reduceMotion ? false : { opacity: 0, x: -28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden="true"
        >
          {meta.index}
        </motion.span>
        <div className="module-intro-icon">
          <Icon size={22} strokeWidth={1.7} />
        </div>
        <div>
          <p>{meta.eyebrow}</p>
          <h1>{meta.title}</h1>
        </div>
        <p className="module-description">{meta.description}</p>
      </section>

      {error ? (
        <div className="error-banner module-error">
          <span>{error}</span>
          <button onClick={onDismissError}>Dismiss</button>
        </div>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          className={`module-stage module-stage-${active}`}
          key={active}
          initial={reduceMotion ? false : { opacity: 0, x: 34, scale: 0.99 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -24, scale: 0.99 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          aria-label={`${meta.title} module`}
        >
          {children}
        </motion.section>
      </AnimatePresence>

      <div className="workspace-dock-wrap">
        <ModuleDock active={active} onSelect={onSelect} compact />
      </div>
    </main>
  );
}
