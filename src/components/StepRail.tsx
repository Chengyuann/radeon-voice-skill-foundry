import {
  AudioWaveform,
  Braces,
  FileCheck2,
  ListTree,
  ShieldCheck
} from "lucide-react";

const steps = [
  { id: "capture", label: "Capture", icon: AudioWaveform },
  { id: "align", label: "Align", icon: ListTree },
  { id: "compile", label: "Compile", icon: Braces },
  { id: "verify", label: "Verify", icon: ShieldCheck },
  { id: "proof", label: "Proof", icon: FileCheck2 }
];

type StepRailProps = {
  active: number;
};

export function StepRail({ active }: StepRailProps) {
  return (
    <nav className="step-rail" aria-label="Foundry progress">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const state =
          index < active ? "complete" : index === active ? "active" : "pending";
        return (
          <div className={`step-item step-${state}`} key={step.id}>
            <div className="step-icon">
              <Icon size={17} strokeWidth={1.8} />
            </div>
            <span>{step.label}</span>
          </div>
        );
      })}
    </nav>
  );
}
