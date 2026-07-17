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
});

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
