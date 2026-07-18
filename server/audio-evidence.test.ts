import { describe, expect, it } from "vitest";
import { analyzeAudioEvidence } from "./audio-evidence.js";

describe("voice evidence analyzer", () => {
  it("passes a healthy speech-like WAV and records its hash", () => {
    const audio = buildWav({
      seconds: 4,
      sample: (time) => 0.18 * Math.sin(2 * Math.PI * 220 * time)
    });
    const evidence = analyzeAudioEvidence(audio);

    expect(evidence.status).toBe("pass");
    expect(evidence.qualityScore).toBeGreaterThanOrEqual(90);
    expect(evidence.sampleRateHz).toBe(16_000);
    expect(evidence.audioSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(evidence.schemaVersion).toBe("0.3.0");
    expect(evidence.estimatedSnrDb).toBeGreaterThanOrEqual(20);
    expect(evidence.crestFactorDb).toBeGreaterThan(2);
  });

  it("quarantines silent audio", () => {
    const evidence = analyzeAudioEvidence(
      buildWav({ seconds: 2, sample: () => 0 })
    );

    expect(evidence.status).toBe("quarantine");
    expect(evidence.issues.join(" ")).toMatch(/silent|quiet/i);
  });

  it("quarantines severe clipping", () => {
    const evidence = analyzeAudioEvidence(
      buildWav({
        seconds: 4,
        sample: (time) =>
          Math.sin(2 * Math.PI * 220 * time) > 0 ? 0.999 : -0.999
      })
    );

    expect(evidence.status).toBe("quarantine");
    expect(evidence.clippingRatio).toBeGreaterThan(0.04);
  });

  it("requires review for intermittent clipping", () => {
    const evidence = analyzeAudioEvidence(
      buildWav({
        seconds: 4,
        sample: (time) =>
          Math.floor(time * 16_000) % 100 === 0
            ? 0.999
            : 0.18 * Math.sin(2 * Math.PI * 220 * time)
      })
    );

    expect(evidence.status).toBe("review");
    expect(evidence.clippingRatio).toBeGreaterThan(0.005);
    expect(evidence.clippingRatio).toBeLessThan(0.04);
  });

  it("detects low signal-to-noise speech", () => {
    const evidence = analyzeAudioEvidence(
      buildWav({
        seconds: 4,
        sample: (time) => {
          const noise = 0.025 * Math.sin(2 * Math.PI * 971 * time);
          const speechBlock = Math.floor(time * 10) % 2 === 0;
          return (
            noise +
            (speechBlock ? 0.035 * Math.sin(2 * Math.PI * 220 * time) : 0)
          );
        }
      })
    );

    expect(evidence.diagnostics?.some((item) => item.code === "low_snr")).toBe(
      true
    );
    expect(evidence.status).not.toBe("pass");
  });

  it("detects DC offset", () => {
    const evidence = analyzeAudioEvidence(
      buildWav({
        seconds: 4,
        sample: (time) => 0.12 + 0.12 * Math.sin(2 * Math.PI * 220 * time)
      })
    );

    expect(evidence.dcOffset).toBeGreaterThan(0.1);
    expect(
      evidence.diagnostics?.some((item) => item.code === "dc_offset")
    ).toBe(true);
  });

  it("does not flag natural pauses as burst loss", () => {
    const evidence = analyzeAudioEvidence(
      buildWav({
        seconds: 4,
        sample: (time) => {
          const phase = time % 1;
          return phase > 0.72
            ? 0.001 * Math.sin(2 * Math.PI * 731 * time)
            : 0.18 * Math.sin(2 * Math.PI * 220 * time);
        }
      })
    );

    expect(evidence.burstLossRatio).toBe(0);
    expect(
      evidence.diagnostics?.some((item) => item.code === "burst_loss")
    ).toBe(false);
  });

  it("requires review for repeated 120 ms burst loss", () => {
    const evidence = analyzeAudioEvidence(
      buildBurstLossWav(120, 1.5)
    );

    expect(evidence.burstLossRatio).toBeGreaterThan(0.04);
    expect(evidence.burstLossRatio).toBeLessThanOrEqual(0.12);
    expect(
      evidence.diagnostics?.some(
        (item) =>
          item.code === "burst_loss" && item.severity === "review"
      )
    ).toBe(true);
    expect(evidence.status).toBe("review");
  });

  it("quarantines repeated 280 ms burst loss", () => {
    const evidence = analyzeAudioEvidence(
      buildBurstLossWav(280, 1.1)
    );

    expect(evidence.burstLossRatio).toBeGreaterThan(0.12);
    expect(
      evidence.diagnostics?.some(
        (item) =>
          item.code === "burst_loss" && item.severity === "quarantine"
      )
    ).toBe(true);
    expect(evidence.status).toBe("quarantine");
  });
});

function buildBurstLossWav(dropoutMs: number, spacingSeconds: number): Buffer {
  return buildWav({
    seconds: 6,
    sample: (time) => {
      const afterOffset = time - 0.7;
      if (afterOffset >= 0) {
        const withinCycle = afterOffset % spacingSeconds;
        if (withinCycle < dropoutMs / 1000) return 0;
      }
      return 0.18 * Math.sin(2 * Math.PI * 220 * time);
    }
  });
}

function buildWav(input: {
  seconds: number;
  sample: (time: number) => number;
}): Buffer {
  const sampleRate = 16_000;
  const samples = Math.floor(sampleRate * input.seconds);
  const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + samples * 2, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(samples * 2, 40);

  for (let index = 0; index < samples; index += 1) {
    const value = Math.max(-1, Math.min(1, input.sample(index / sampleRate)));
    buffer.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  return buffer;
}
