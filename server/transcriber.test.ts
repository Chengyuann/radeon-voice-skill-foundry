import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { transcribeAudioBuffer } from "./transcriber.js";

describe("audio transcription adapter", () => {
  it("fails clearly when Radeon ASR is not configured", async () => {
    const originalBase = process.env.RADEON_OPENAI_BASE_URL;
    const originalAsr = process.env.RADEON_ASR_BASE_URL;
    const originalCommand = process.env.RADEON_ASR_COMMAND;
    delete process.env.RADEON_OPENAI_BASE_URL;
    delete process.env.RADEON_ASR_BASE_URL;
    delete process.env.RADEON_ASR_COMMAND;

    await expect(
      transcribeAudioBuffer(Buffer.from("not-audio"), "sample.wav")
    ).rejects.toThrow("Radeon ASR is not configured");

    if (originalBase) process.env.RADEON_OPENAI_BASE_URL = originalBase;
    if (originalAsr) process.env.RADEON_ASR_BASE_URL = originalAsr;
    if (originalCommand) process.env.RADEON_ASR_COMMAND = originalCommand;
  });

  it("allows a configured ASR command without an Agent model endpoint", async () => {
    const originalBase = process.env.RADEON_OPENAI_BASE_URL;
    const originalAsr = process.env.RADEON_ASR_BASE_URL;
    const originalCommand = process.env.RADEON_ASR_COMMAND;
    const script = path.join(tmpdir(), `rvsf-asr-${Date.now()}.mjs`);
    await writeFile(
      script,
      'console.log(JSON.stringify({transcript:"Never send automatically. Redact compensation data.",language:"en",audioSeconds:1,inferenceMs:1,rtf:0.001,xRealtime:1000}));'
    );
    delete process.env.RADEON_OPENAI_BASE_URL;
    delete process.env.RADEON_ASR_BASE_URL;
    process.env.RADEON_ASR_COMMAND = `node ${script}`;

    try {
      const result = await transcribeAudioBuffer(
        buildWav(),
        "configured-command.wav"
      );
      expect(result.transcript).toContain("Never send");
      expect(result.runtime.mode).toBe("deterministic");
      expect(result.voiceEvidenceId).toMatch(/^voice_[a-f0-9]{12}$/);
    } finally {
      restoreEnv("RADEON_OPENAI_BASE_URL", originalBase);
      restoreEnv("RADEON_ASR_BASE_URL", originalAsr);
      restoreEnv("RADEON_ASR_COMMAND", originalCommand);
      await rm(script, { force: true });
    }
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function buildWav(): Buffer {
  const sampleRate = 16_000;
  const samples = sampleRate;
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
    const value = 0.18 * Math.sin((2 * Math.PI * 220 * index) / sampleRate);
    buffer.writeInt16LE(Math.round(value * 32767), 44 + index * 2);
  }
  return buffer;
}
