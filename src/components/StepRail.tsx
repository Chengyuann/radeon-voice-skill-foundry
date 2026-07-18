import {
  AudioWaveform,
  Braces,
  FileCheck2,
  ListTree,
  ShieldCheck
} from "lucide-react";
import { Stepper } from "../react-bits/Stepper";

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
  return <Stepper steps={steps} active={active} />;
}
