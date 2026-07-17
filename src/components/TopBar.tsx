import {
  AudioLines,
  CheckCircle2,
  Cpu,
  Github,
  ShieldCheck
} from "lucide-react";
import type { RuntimeInfo } from "../../shared/types";
import { Badge } from "./Badge";

type TopBarProps = {
  runtime?: RuntimeInfo;
  status: "draft" | "compiled" | "verified" | "quarantined";
};

export function TopBar({ runtime, status }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <AudioLines size={19} strokeWidth={1.8} />
        </div>
        <div>
          <strong>Radeon Voice Skill Foundry</strong>
          <span>Speak the SOP. Prove the Skill.</span>
        </div>
      </div>

      <div className="topbar-status">
        <Badge tone={runtime?.mode === "radeon" ? "green" : "amber"}>
          <Cpu size={13} />
          {runtime?.mode === "radeon" ? "Radeon runtime" : "Local fallback"}
        </Badge>
        <Badge
          tone={
            status === "verified"
              ? "green"
              : status === "quarantined"
                ? "red"
                : status === "compiled"
                  ? "blue"
                  : "neutral"
          }
        >
          {status === "verified" ? (
            <CheckCircle2 size={13} />
          ) : (
            <ShieldCheck size={13} />
          )}
          {status}
        </Badge>
        <a
          className="icon-link"
          href="https://github.com/AMD-DEV-CONTEST/Radeon-hackathon-2026-07"
          target="_blank"
          rel="noreferrer"
          aria-label="Official AMD hackathon repository"
          title="Official AMD hackathon repository"
        >
          <Github size={18} strokeWidth={1.8} />
        </a>
      </div>
    </header>
  );
}
