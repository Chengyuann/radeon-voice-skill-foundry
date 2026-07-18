import {
  AudioWaveform,
  Cpu
} from "lucide-react";
import { AnimatedContent } from "../react-bits/AnimatedContent";
import { DecryptedText } from "../react-bits/DecryptedText";
import { ModuleDock, type WorkbenchModule } from "./ModuleDock";

type CinematicHeroProps = {
  onOpenModule: (module: WorkbenchModule) => void;
};

export function CinematicHero({ onOpenModule }: CinematicHeroProps) {
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
              <span>Radeon</span>
              <strong>
                <DecryptedText text="Voice Foundry" speed={16} />
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

          <div className="hero-dock-wrap">
            <ModuleDock onSelect={onOpenModule} />
          </div>
        </AnimatedContent>
      </div>
    </section>
  );
}
