import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
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
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "rvsf-voice-store-"));
    process.env.RVSF_DATA_DIR = directory;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.RVSF_DATA_DIR;
    await rm(directory, { recursive: true, force: true });
  });

  it("binds server-held evidence to the original ASR transcript", async () => {
    const record = await registerVoiceEvidence(
      evidence,
      "Never send automatically."
    );

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

  it("returns an isolated copy of authoritative evidence", async () => {
    const record = await registerVoiceEvidence(
      evidence,
      "Redact compensation."
    );
    const resolved = await resolveVoiceEvidence(record.id);
    resolved.evidence.qualityScore = 0;

    expect((await resolveVoiceEvidence(record.id)).evidence.qualityScore).toBe(
      96
    );
  });

  it("survives module reloads through the disk store", async () => {
    const firstStore = await import("./voice-evidence-store.js");
    const record = await firstStore.registerVoiceEvidence(
      evidence,
      "Keep the transcript bound."
    );
    vi.resetModules();
    const reloadedStore = await import("./voice-evidence-store.js");

    expect(
      (await reloadedStore.resolveVoiceEvidence(record.id)).evidence
        .qualityScore
    ).toBe(96);
  });
});
