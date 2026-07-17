import type { VoiceEvidence } from "../shared/types.js";
import { id, textHash } from "./hash.js";

type VoiceEvidenceRecord = {
  id: string;
  evidence: VoiceEvidence;
  createdAt: string;
};

const records = new Map<string, VoiceEvidenceRecord>();
const maxRecords = 100;

export function registerVoiceEvidence(
  evidence: VoiceEvidence,
  asrTranscript: string
): VoiceEvidenceRecord {
  const record: VoiceEvidenceRecord = {
    id: id("voice"),
    evidence: {
      ...structuredClone(evidence),
      asrTranscriptSha256: textHash(asrTranscript)
    },
    createdAt: new Date().toISOString()
  };
  records.set(record.id, record);
  trimRecords();
  return structuredClone(record);
}

export function resolveVoiceEvidence(idValue: string): VoiceEvidenceRecord {
  const record = records.get(idValue);
  if (!record) {
    throw new Error(
      "Voice evidence is unavailable or expired; transcribe the audio again"
    );
  }
  return structuredClone(record);
}

export function transcriptMatchesVoiceEvidence(
  evidence: VoiceEvidence,
  transcript: string
): boolean {
  return (
    Boolean(evidence.asrTranscriptSha256) &&
    evidence.asrTranscriptSha256 === textHash(transcript)
  );
}

function trimRecords(): void {
  while (records.size > maxRecords) {
    const oldest = records.keys().next().value as string | undefined;
    if (!oldest) return;
    records.delete(oldest);
  }
}
