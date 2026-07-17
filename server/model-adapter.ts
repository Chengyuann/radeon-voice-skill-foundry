import { compactConstraintArraySchema } from "../shared/schema.js";
import type {
  ActionEvent,
  Constraint,
  ConstraintKind,
  ModelMetrics
} from "../shared/types.js";
import { id } from "./hash.js";

type ModelInput = {
  transcript: string;
  scenario: string;
  actions: ActionEvent[];
  ragContext?: string;
  existingConstraints?: Constraint[];
};

type ModelExtraction = {
  constraints: Constraint[];
  metrics?: ModelMetrics;
};

const MODEL_MAX_OUTPUT_TOKENS = 520;
const MODEL_REPAIR_MAX_OUTPUT_TOKENS = 900;

export async function extractConstraintsWithModel(
  input: ModelInput
): Promise<ModelExtraction | null> {
  const baseUrl = process.env.RADEON_OPENAI_BASE_URL?.replace(/\/$/, "");
  const model = process.env.RADEON_MODEL;
  if (!baseUrl || !model) {
    return null;
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.RADEON_API_KEY
        ? { Authorization: `Bearer ${process.env.RADEON_API_KEY}` }
        : {})
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: MODEL_MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Extract enforceable SOP constraints as compact JSON: {\"constraints\":[{\"kind\":\"must|must_not|only_if|unless|redact|requires_confirmation\",\"statement\":\"...\",\"sourceText\":\"...\",\"appliesTo\":[\"action_type\"]}]}. Omit id and confidence; the runtime supplies them. Sensitive-field exclusion, masking, aliasing, or replacement MUST use redact, even when phrased as never include. Example: 'Never include compensation data' is redact, not must_not. Prohibited side effects MUST use must_not. Split allowed work and its prohibition into separate rules, such as draft email plus do not send. Use only_if for conditions and requires_confirmation for risk or missing context. Return atomic, non-duplicate rules only. Do not invent rules."
        },
        {
          role: "user",
          content: JSON.stringify(input)
        }
      ]
    }),
    signal: AbortSignal.timeout(45_000)
  });

  if (!response.ok) {
    throw new Error(`Radeon model request failed with ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    metrics?: Partial<ModelMetrics>;
  };
  let content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Radeon model returned no content");
  }

  let parsed: { constraints?: unknown };
  try {
    parsed = JSON.parse(extractJson(content)) as { constraints?: unknown };
  } catch {
    content = await repairJsonWithModel(baseUrl, model, content);
    parsed = JSON.parse(extractJson(content)) as { constraints?: unknown };
  }
  const metrics = normalizeMetrics(payload.metrics);
  return {
    constraints: hydrateModelConstraints(
      compactConstraintArraySchema.parse(parsed.constraints)
    ),
    ...(metrics ? { metrics } : {})
  };
}

export function hydrateModelConstraints(
  constraints: Array<{
    kind: ConstraintKind;
    statement: string;
    sourceText: string;
    appliesTo: string[];
  }>
): Constraint[] {
  return constraints.map((constraint) => ({
    ...constraint,
    id: id("rule"),
    confidence: modelConfidence(constraint.kind)
  }));
}

async function repairJsonWithModel(
  baseUrl: string,
  model: string,
  content: string
): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.RADEON_API_KEY
        ? { Authorization: `Bearer ${process.env.RADEON_API_KEY}` }
        : {})
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: MODEL_REPAIR_MAX_OUTPUT_TOKENS,
      messages: [
        {
          role: "system",
          content:
            "Repair the following truncated or invalid JSON. Return one valid JSON object only. Preserve only complete constraints; do not invent new constraints."
        },
        { role: "user", content }
      ]
    }),
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) {
    throw new Error(`JSON repair failed with ${response.status}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const repaired = payload.choices?.[0]?.message?.content;
  if (!repaired) throw new Error("JSON repair returned no content");
  return repaired;
}

function modelConfidence(kind: ConstraintKind): number {
  return ["must_not", "redact", "requires_confirmation"].includes(kind)
    ? 0.92
    : 0.9;
}

function extractJson(content: string): string {
  const trimmed = content.trim();
  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}

function normalizeMetrics(
  metrics: Partial<ModelMetrics> | undefined
): ModelMetrics | undefined {
  if (
    !metrics ||
    typeof metrics.ttftMs !== "number" ||
    typeof metrics.generationMs !== "number" ||
    typeof metrics.tokensPerSecond !== "number" ||
    typeof metrics.inputTokens !== "number" ||
    typeof metrics.outputTokens !== "number"
  ) {
    return undefined;
  }
  return {
    ttftMs: metrics.ttftMs,
    generationMs: metrics.generationMs,
    tokensPerSecond: metrics.tokensPerSecond,
    inputTokens: metrics.inputTokens,
    outputTokens: metrics.outputTokens,
    ...(typeof metrics.peakVramGiB === "number"
      ? { peakVramGiB: metrics.peakVramGiB }
      : {})
  };
}
