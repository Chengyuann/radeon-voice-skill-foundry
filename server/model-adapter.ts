import { compactConstraintArraySchema } from "../shared/schema.js";
import type {
  ActionEvent,
  Constraint,
  ConstraintKind,
  ModelMetrics,
  ModelRoute
} from "../shared/types.js";
import { id } from "./hash.js";

type ModelInput = {
  transcript: string;
  scenario: string;
  actions: ActionEvent[];
  ragContext?: string;
  existingConstraints?: Constraint[];
  requiredGuardrails?: Constraint[];
};

type ModelExtraction = {
  constraints: Constraint[];
  metrics?: ModelMetrics;
  route?: ModelRoute;
};

const MODEL_MAX_OUTPUT_TOKENS = 520;
const MODEL_REPAIR_MAX_OUTPUT_TOKENS = 900;
const constraintJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["constraints"],
  properties: {
    constraints: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "statement", "sourceText", "appliesTo"],
        properties: {
          kind: {
            type: "string",
            enum: [
              "must",
              "must_not",
              "only_if",
              "unless",
              "redact",
              "requires_confirmation"
            ]
          },
          statement: { type: "string", minLength: 1 },
          sourceText: { type: "string", minLength: 1 },
          appliesTo: {
            type: "array",
            items: { type: "string" }
          }
        }
      }
    }
  }
} as const;

export async function extractConstraintsWithModel(
  input: ModelInput
): Promise<ModelExtraction | null> {
  const baseUrl = process.env.RADEON_OPENAI_BASE_URL?.replace(/\/$/, "");
  const model = process.env.RADEON_MODEL;
  if (!baseUrl || !model) {
    return null;
  }

  let primary: ModelExtraction;
  try {
    primary = await requestModelExtraction(baseUrl, model, input);
  } catch (error) {
    const fallbackBaseUrl =
      process.env.RADEON_FALLBACK_OPENAI_BASE_URL?.replace(/\/$/, "");
    const fallbackModel = process.env.RADEON_FALLBACK_MODEL;
    if (!fallbackBaseUrl || !fallbackModel) throw error;
    const fallback = await requestModelExtraction(
      fallbackBaseUrl,
      fallbackModel,
      input
    );
    return {
      ...fallback,
      route: {
        selected: "fallback",
        primaryAccepted: false,
        primaryReasons: [`extraction_error:${errorName(error)}`]
      }
    };
  }
  const primaryAdmission = evaluateModelAdmission(
    primary.constraints,
    input.requiredGuardrails || []
  );
  const fallbackBaseUrl =
    process.env.RADEON_FALLBACK_OPENAI_BASE_URL?.replace(/\/$/, "");
  const fallbackModel = process.env.RADEON_FALLBACK_MODEL;
  if (
    primaryAdmission.accepted ||
    !fallbackBaseUrl ||
    !fallbackModel
  ) {
    return {
      ...primary,
      route: {
        selected: "primary",
        primaryAccepted: primaryAdmission.accepted,
        primaryReasons: primaryAdmission.reasons
      }
    };
  }

  const fallback = await requestModelExtraction(
    fallbackBaseUrl,
    fallbackModel,
    input
  );
  return {
    ...fallback,
    route: {
      selected: "fallback",
      primaryAccepted: false,
      primaryReasons: primaryAdmission.reasons
    }
  };
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

async function requestModelExtraction(
  baseUrl: string,
  model: string,
  input: ModelInput
): Promise<ModelExtraction> {
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
      response_format: modelResponseFormat(),
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
      compactConstraintArraySchema.parse(parsed.constraints),
      input.actions
    ),
    ...(metrics ? { metrics } : {})
  };
}

function modelResponseFormat():
  | { type: "json_object" }
  | {
      type: "json_schema";
      json_schema: {
        name: string;
        strict: true;
        schema: typeof constraintJsonSchema;
      };
    } {
  return process.env.RADEON_STRUCTURED_OUTPUTS === "json_schema"
    ? {
        type: "json_schema",
        json_schema: {
          name: "sop_constraints",
          strict: true,
          schema: constraintJsonSchema
        }
      }
    : { type: "json_object" };
}

export function evaluateModelAdmission(
  constraints: Constraint[],
  requiredGuardrails: Constraint[]
): { accepted: boolean; reasons: string[] } {
  const requiredKinds = new Set(
    requiredGuardrails
      .filter((constraint) =>
        ["must_not", "redact", "only_if", "requires_confirmation"].includes(
          constraint.kind
        )
      )
      .map((constraint) => constraint.kind)
  );
  const candidateKinds = new Set(
    constraints.map((constraint) => constraint.kind)
  );
  const reasons = [...requiredKinds]
    .filter((kind) => !candidateKinds.has(kind))
    .map((kind) => `missing_${kind}`);
  if (!constraints.length) reasons.push("empty_constraints");
  return { accepted: reasons.length === 0, reasons };
}

export function hydrateModelConstraints(
  constraints: Array<{
    kind: ConstraintKind;
    statement: string;
    sourceText: string;
    appliesTo?: string[];
  }>,
  actions: ActionEvent[] = []
): Constraint[] {
  return constraints.map((constraint) => ({
    ...constraint,
    appliesTo: alignModelActions(constraint.appliesTo || [], actions),
    id: id("rule"),
    confidence: modelConfidence(constraint.kind)
  }));
}

function alignModelActions(
  suggested: string[],
  actions: ActionEvent[]
): string[] {
  if (!actions.length) return suggested;
  const available = new Set(actions.map((action) => action.type));
  const aligned = suggested.filter((type) => available.has(type as ActionEvent["type"]));
  return aligned.length ? aligned : [actions[0].type];
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
