import {
  ArrowDown,
  AudioWaveform,
  Braces,
  Cpu,
  ShieldCheck,
  Zap
} from "lucide-react";
import type { RuntimeInfo } from "../../shared/types";
import { AnimatedContent } from "../react-bits/AnimatedContent";
import { CountUp } from "../react-bits/CountUp";
import { DecryptedText } from "../react-bits/DecryptedText";
import { Magnet } from "../react-bits/Magnet";

type CinematicHeroProps = {
  runtime?: RuntimeInfo;
  onEnterWorkbench: () => void;
};

const heroMetrics = [
  { label: "vLLM C8", value: 257.65, decimals: 2, suffix: " tok/s" },
  { label: "Serving uplift", value: 12.47, decimals: 2, suffix: "x" },
  { label: "ASR batch", value: 85.35, decimals: 2, suffix: "x RT" }
];

export function CinematicHero({
  runtime,
  onEnterWorkbench
}: CinematicHeroProps) {
  return (
    <section className="cinematic-hero" aria-labelledby="hero-title">
      <video
        className="cinematic-hero-video"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/media/radeon-foundry-hero-poster.jpg"
        aria-hidden="true"
      >
        <source src="/media/radeon-foundry-hero.mp4" type="video/mp4" />
      </video>
      <div className="cinematic-hero-shade" aria-hidden="true" />
      <div className="cinematic-hero-grid" aria-hidden="true" />

      <div className="cinematic-hero-content">
        <AnimatedContent className="hero-kicker" distance={12}>
          <span>
            <Cpu size={14} />
            AMD Radeon · ROCm 7.2.1
          </span>
          <span>Track 2 · Private AI Agents</span>
        </AnimatedContent>

        <div className="hero-title-stage">
          <AnimatedContent delay={0.08} distance={32}>
            <h1 id="hero-title">
              <span>Radeon Voice</span>
              <strong>
                <DecryptedText text="Skill Foundry" speed={16} />
              </strong>
            </h1>
          </AnimatedContent>
        </div>

        <AnimatedContent className="hero-bottom" delay={0.2} distance={20}>
          <div className="hero-manifesto">
            <span className="hero-manifesto-icon">
              <AudioWaveform size={18} />
            </span>
            <p>
              Speak a private SOP. Compile its hidden rules. Verify every unsafe
              path before the Agent can act.
            </p>
          </div>

          <div className="hero-metrics">
            {heroMetrics.map((metric, index) => (
              <div key={metric.label}>
                <small>{metric.label}</small>
                <strong>
                  <CountUp
                    to={metric.value}
                    decimals={metric.decimals}
                    suffix={metric.suffix}
                    delay={0.22 + index * 0.06}
                    duration={0.9}
                  />
                </strong>
              </div>
            ))}
          </div>

          <Magnet className="hero-enter-magnet" strength={12}>
            <button
              className="hero-enter"
              type="button"
              onClick={onEnterWorkbench}
            >
              <span>
                <Braces size={17} />
                Enter workbench
              </span>
              <ArrowDown size={18} />
            </button>
          </Magnet>
        </AnimatedContent>

        <div className="hero-proof-rail">
          <span>
            <ShieldCheck size={14} />
            Voice Evidence v0.3
          </span>
          <span>
            <Zap size={14} />
            33/33 proof suite
          </span>
          <span>{runtime?.gpu || "gfx1100 · 48 GB VRAM"}</span>
        </div>
      </div>
    </section>
  );
}
