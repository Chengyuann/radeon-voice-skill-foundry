import { describe, expect, it } from "vitest";
import { transcribeAudioBuffer } from "./transcriber.js";

describe("audio transcription adapter", () => {
  it("fails clearly when Radeon ASR is not configured", async () => {
    const originalBase = process.env.RADEON_OPENAI_BASE_URL;
    const originalAsr = process.env.RADEON_ASR_BASE_URL;
    delete process.env.RADEON_OPENAI_BASE_URL;
    delete process.env.RADEON_ASR_BASE_URL;

    await expect(
      transcribeAudioBuffer(Buffer.from("not-audio"), "sample.wav")
    ).rejects.toThrow("Radeon ASR is not configured");

    if (originalBase) process.env.RADEON_OPENAI_BASE_URL = originalBase;
    if (originalAsr) process.env.RADEON_ASR_BASE_URL = originalAsr;
  });
});
