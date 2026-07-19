import {
  Activity,
  AudioWaveform,
  Gauge,
  Microchip,
  ShieldCheck,
  Zap
} from "lucide-react";
import type { RuntimeInfo } from "../../shared/types";
import { AnimatedContent } from "../react-bits/AnimatedContent";
import { CountUp } from "../react-bits/CountUp";
import { SpotlightCard } from "../react-bits/SpotlightCard";

type PerformanceStripProps = {
  runtime?: RuntimeInfo;
};

const metrics = [
  {
    label: "vLLM C8",
    value: 257.65,
    decimals: 2,
    suffix: " tok/s",
    icon: Zap
  },
  {
    label: "Serving uplift",
    value: 12.47,
    decimals: 2,
    suffix: "x",
    icon: Gauge
  },
  {
    label: "ASR batch",
    value: 85.35,
    decimals: 2,
    suffix: "x RT",
    icon: AudioWaveform
  },
  {
    label: "Proof suite",
    value: 42,
    decimals: 0,
    suffix: "/42",
    icon: ShieldCheck
  }
];

export function PerformanceStrip({ runtime }: PerformanceStripProps) {
  return (
    <AnimatedContent className="performance-strip" delay={0.06}>
      <div className="performance-runtime">
        <span className="performance-live">
          <Activity size={13} />
          W7900 evidence
        </span>
        <strong>
          <Microchip size={16} />
          {runtime?.gpu || "gfx1100 · ROCm 7.2.1"}
        </strong>
        <small>Measured W7900 evidence · current product suite 42/42</small>
      </div>
      <div className="performance-metrics">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <SpotlightCard
              className="performance-metric"
              spotlightColor="rgba(194, 58, 53, 0.09)"
              key={metric.label}
            >
              <Icon size={15} strokeWidth={1.8} />
              <span>
                <small>{metric.label}</small>
                <strong>
                  <CountUp
                    to={metric.value}
                    decimals={metric.decimals}
                    suffix={metric.suffix}
                    delay={index * 0.04}
                    duration={0.8}
                  />
                </strong>
              </span>
            </SpotlightCard>
          );
        })}
      </div>
    </AnimatedContent>
  );
}
