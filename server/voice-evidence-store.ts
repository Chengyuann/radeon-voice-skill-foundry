import type { VoiceEvidence } from "../shared/types.js";
import { dataFile, readStoredJson, updateStoredJson } from "./file-store.js";
import { id, textHash } from "./hash.js";

export type VoiceEvidenceRecord = {
  id: string;
  evidence: VoiceEvidence;
  createdAt: string;
};

const maxRecords = 100;
const recordsPath = () => dataFile("voice-evidence-records.json");

export async function registerVoiceEvidence(
  evidence: VoiceEvidence,
  asrTranscript: string
): Promise<VoiceEvidenceRecord> {
  const record: VoiceEvidenceRecord = {
    id: id("voice"),
    evidence: {
      ...structuredClone(evidence),
      asrTranscriptSha256: textHash(asrTranscript)
    },
    createdAt: new Date().toISOString()
  };
  return updateStoredJson(recordsPath(), [], (records: VoiceEvidenceRecord[]) => {
    records.push(record);
    records.splice(0, Math.max(0, records.length - maxRecords));
    return structuredClone(record);
  });
}

export async function resolveVoiceEvidence(
  idValue: string
): Promise<VoiceEvidenceRecord> {
  const records = await readStoredJson<VoiceEvidenceRecord[]>(recordsPath(), []);
  const record = records.find((item) => item.id === idValue);
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

export async function voiceEvidenceRecordCount(): Promise<number> {
  return (await readStoredJson<VoiceEvidenceRecord[]>(recordsPath(), [])).length;
}
