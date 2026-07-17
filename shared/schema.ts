import { z } from "zod";

export const actionEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "open_document",
    "filter_findings",
    "select_commitment",
    "draft_email",
    "send_email",
    "create_calendar_hold",
    "write_report"
  ]),
  label: z.string().min(1),
  timestampMs: z.number().nonnegative(),
  payload: z.record(z.unknown()).optional()
});

export const voiceEvidenceSchema = z.object({
  schemaVersion: z.literal("0.1.0"),
  status: z.enum(["pass", "review", "quarantine"]),
  qualityScore: z.number().min(0).max(100),
  format: z.string(),
  sampleRateHz: z.number().positive().optional(),
  channels: z.number().int().positive().optional(),
  durationSeconds: z.number().nonnegative().optional(),
  rmsDbfs: z.number().optional(),
  peakDbfs: z.number().optional(),
  clippingRatio: z.number().min(0).max(1).optional(),
  silenceRatio: z.number().min(0).max(1).optional(),
  audioSha256: z.string().regex(/^[a-f0-9]{64}$/),
  asrTranscriptSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  issues: z.array(z.string()).max(20),
  analyzedAt: z.string()
});

export const compileRequestSchema = z.object({
  projectName: z.string().min(2).max(80),
  scenario: z.string().min(10).max(1000),
  transcript: z.string().min(20).max(12000),
  actions: z.array(actionEventSchema).min(1).max(50),
  useModel: z.boolean().optional(),
  voiceEvidenceId: z.string().regex(/^voice_[a-f0-9]{12}$/).optional(),
  voiceEvidenceReviewed: z.boolean().optional()
});

export const constraintSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "must",
    "must_not",
    "only_if",
    "unless",
    "redact",
    "requires_confirmation"
  ]),
  statement: z.string(),
  sourceText: z.string(),
  confidence: z.number().min(0).max(1),
  appliesTo: z.array(z.string())
});

export const constraintArraySchema = z.array(constraintSchema).max(40);

export const compactConstraintSchema = constraintSchema.omit({
  id: true,
  confidence: true
});

export const compactConstraintArraySchema = z
  .array(compactConstraintSchema)
  .max(24);

export const knowledgeDocumentInputSchema = z.object({
  title: z.string().min(2).max(120),
  content: z.string().min(20).max(20000)
});

export const knowledgeSearchSchema = z.object({
  query: z.string().min(2).max(4000),
  limit: z.number().int().min(1).max(10).optional()
});

export const refineRequestSchema = z.object({
  compilation: z.object({
    runId: z.string(),
    projectName: z.string(),
    scenario: z.string(),
    constraints: z.array(constraintSchema)
  }).passthrough(),
  message: z.string().min(3).max(4000),
  actions: z.array(actionEventSchema).min(1).max(50),
  useModel: z.boolean().optional()
});
