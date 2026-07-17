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

export const compileRequestSchema = z.object({
  projectName: z.string().min(2).max(80),
  scenario: z.string().min(10).max(1000),
  transcript: z.string().min(20).max(12000),
  actions: z.array(actionEventSchema).min(1).max(50),
  useModel: z.boolean().optional()
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
