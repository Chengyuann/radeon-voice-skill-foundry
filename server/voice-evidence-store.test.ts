import { describe, expect, it } from "vitest";
import type { VoiceEvidence } from "../shared/types.js";
import {
  registerVoiceEvidence,
  resolveVoiceEvidence,
  transcriptMatchesVoiceEvidence
} from "./voice-evidence-store.js";

const evidence: VoiceEvidence = {
  schemaVersion: "0.1.0",
  status: "pass",
  qualityScore: 96,
  format: "PCM 16-bit WAV",
  audioSha256: "a".repeat(64),
  issues: [],
  analyzedAt: "2026-07-18T00:00:00.000Z"
};

describe("voice evidence store", () => {
  it("binds server-held evidence to the original ASR transcript", () => {
    const record = registerVoiceEvidence(evidence, "Never send automatically.");

    expect(record.id).toMatch(/^voice_[a-f0-9]{12}$/);
    expect(record.evidence.asrTranscriptSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(
      transcriptMatchesVoiceEvidence(
        record.evidence,
        "Never send automatically."
      )
    ).toBe(true);
    expect(
      transcriptMatchesVoiceEvidence(
        record.evidence,
        "Send automatically."
      )
    ).toBe(false);
  });

  it("returns an isolated copy of authoritative evidence", () => {
    const record = registerVoiceEvidence(evidence, "Redact compensation.");
    const resolved = resolveVoiceEvidence(record.id);
    resolved.evidence.qualityScore = 0;

    expect(resolveVoiceEvidence(record.id).evidence.qualityScore).toBe(96);
  });
});
