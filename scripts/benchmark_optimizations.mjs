#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const modelBaseUrl = (
  process.env.RADEON_OPENAI_BASE_URL || "http://127.0.0.1:8000/v1"
).replace(/\/$/, "");
const appBaseUrl = (
  process.env.RVSF_APP_BASE_URL || "http://127.0.0.1:8791"
).replace(/\/$/, "");
const model = process.env.RADEON_MODEL || "Qwen/Qwen3-4B-Instruct-2507";
const runs = Number(process.env.BENCHMARK_RUNS || 3);
const output =
  process.argv[2] ||
  path.resolve("benchmarks", "optimization-latest.json");

const input = {
  projectName: "review-followup",
  scenario:
    "Turn a private project review into a safe follow-up package with prioritized findings, draft emails, tentative calendar holds, and a redacted external report.",
  transcript:
    "After each project review, read the meeting note and only include P0 and P1 findings. Never include compensation data in the external report. Draft follow-up emails for each owner, but do not send them automatically. If an owner is missing, mark the item as needs confirmation instead of guessing. Create tentative calendar holds only when a due date is present. Replace every customer name with the approved account alias before writing the report.",
  actions: [
    {
      id: "act-1",
      type: "open_document",
      label: "Open private review note",
      timestampMs: 800
    },
    {
      id: "act-2",
      type: "filter_findings",
      label: "Keep P0 and P1 findings",
      timestampMs: 6200
    },
    {
      id: "act-3",
      type: "select_commitment",
      label: "Resolve owner and due date",
      timestampMs: 11200
    },
    {
      id: "act-4",
      type: "draft_email",
      label: "Create owner follow-up drafts",
      timestampMs: 16900
    },
    {
      id: "act-5",
      type: "create_calendar_hold",
      label: "Create tentative due-date holds",
      timestampMs: 23500
    },
    {
      id: "act-6",
      type: "write_report",
      label: "Export redacted external audit report",
      timestampMs: 29800
    }
  ],
  ragContext:
    "External Reporting and Privacy Policy: External reports must exclude compensation and personal identifiers. Email and Calendar Action Policy: Sending email requires explicit human approval."
};

const baselinePrompt =
  "Extract enforceable SOP constraints. Return JSON with a constraints array. Each item must contain id, kind (must, must_not, only_if, unless, redact, requires_confirmation), statement, sourceText, confidence from 0 to 1, and appliesTo action type strings. Use redact for sensitive fields that must be removed, masked, aliased, or excluded from an output. Use must_not for prohibited actions such as send, delete, publish, or execute. Use only_if for conditions, and requires_confirmation when missing context or risk requires human review. Separate compound spoken rules into distinct constraints. Do not invent rules.";

const compactPrompt =
  'Extract enforceable SOP constraints as compact JSON: {"constraints":[{"kind":"must|must_not|only_if|unless|redact|requires_confirmation","statement":"...","sourceText":"...","appliesTo":["action_type"]}]}. Omit id and confidence; the runtime supplies them. Sensitive-field exclusion, masking, aliasing, or replacement MUST use redact, even when phrased as never include. Example: "Never include compensation data" is redact, not must_not. Prohibited side effects MUST use must_not. Split allowed work and its prohibition into separate rules, such as draft email plus do not send. Use only_if for conditions and requires_confirmation for risk or missing context. Return atomic, non-duplicate rules only. Do not invent rules.';

const variants = [
  { name: "baseline", maxTokens: 900, prompt: baselinePrompt },
  { name: "compact", maxTokens: 520, prompt: compactPrompt }
];

const modelResults = {};
for (const variant of variants) {
  modelResults[variant.name] = [];
  for (let index = 0; index < runs; index += 1) {
    const result = await callModel(variant);
    modelResults[variant.name].push(result);
    console.log(
      `${variant.name} ${index + 1}/${runs}: ` +
        `${result.metrics.outputTokens} tokens, ` +
        `${result.metrics.generationMs} ms`
    );
  }
}

const compileStartedAt = performance.now();
const appCompilation = await requestJson("/api/compile", {
  method: "POST",
  body: JSON.stringify({
    projectName: input.projectName,
    scenario: input.scenario,
    transcript: input.transcript,
    actions: input.actions,
    useModel: true
  })
});
const fullCompilationHttpMs = round(performance.now() - compileStartedAt);
const verification = await requestJson("/api/verify", {
  method: "POST",
  body: JSON.stringify({
    compilation: appCompilation,
    actions: input.actions
  })
});
if (verification.status !== "verified") {
  throw new Error(`Benchmark compilation was ${verification.status}`);
}
const skill = await requestJson(`/api/skills/${verification.runId}`, {
  method: "POST"
});
const reuseResults = [];
for (let index = 0; index < 5; index += 1) {
  const startedAt = performance.now();
  const result = await requestJson(`/api/skills/${skill.id}/reuse`, {
    method: "POST"
  });
  reuseResults.push({
    ...result,
    httpRoundTripMs: round(performance.now() - startedAt)
  });
}

const summary = {
  baseline: summarize(modelResults.baseline),
  compact: summarize(modelResults.compact)
};
const outputTokenReductionPercent = percentageReduction(
  summary.baseline.medianOutputTokens,
  summary.compact.medianOutputTokens
);
const generationLatencyReductionPercent = percentageReduction(
  summary.baseline.medianGenerationMs,
  summary.compact.medianGenerationMs
);
const reuseMedianMs = median(
  reuseResults.map((result) => result.reuseLatencyMs)
);
const reuseHttpMedianMs = median(
  reuseResults.map((result) => result.httpRoundTripMs)
);

const report = {
  measuredAt: new Date().toISOString(),
  environment: {
    gpu: process.env.RADEON_GPU_NAME || "AMD Radeon Pro W7900-class gfx1100 48GB",
    rocm: process.env.ROCM_VERSION || "ROCm 7.2.1",
    serving: "Transformers FP16"
  },
  model,
  modelBaseUrl,
  appBaseUrl,
  runsPerModelVariant: runs,
  variants: {
    baseline: {
      maxTokens: 900,
      fieldsOwnedByModel: ["id", "confidence", "kind", "statement", "sourceText", "appliesTo"],
      runs: modelResults.baseline,
      summary: summary.baseline
    },
    compact: {
      maxTokens: 520,
      fieldsOwnedByModel: ["kind", "statement", "sourceText", "appliesTo"],
      runtimeOwnedFields: ["id", "confidence"],
      runs: modelResults.compact,
      summary: summary.compact
    }
  },
  improvement: {
    outputTokenReductionPercent,
    generationLatencyReductionPercent
  },
  fullCompilation: {
    compileDurationMs: appCompilation.compileDurationMs,
    httpRoundTripMs: fullCompilationHttpMs,
    modelMetrics: appCompilation.modelMetrics,
    constraints: appCompilation.constraints.length,
    mailSend:
      appCompilation.permissions.find(
        (permission) => permission.permission === "mail:send"
      )?.state || "missing",
    verificationStatus: verification.status,
    testsPassed: verification.fixtures.filter(
      (fixture) => fixture.status === "passed"
    ).length,
    testsTotal: verification.fixtures.length
  },
  verifiedSkillReuse: {
    samples: reuseResults.map((result) => ({
      reuseLatencyMs: result.reuseLatencyMs,
      httpRoundTripMs: result.httpRoundTripMs,
      speedup: result.speedup,
      avoidedModelOutputTokens: result.avoidedModelOutputTokens
    })),
    medianServerReuseLatencyMs: reuseMedianMs,
    medianHttpRoundTripMs: reuseHttpMedianMs,
    speedupVsFullCompilationHttp: round(
      fullCompilationHttpMs / Math.max(reuseHttpMedianMs, 0.01)
    )
  }
};

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`wrote ${output}`);
console.log(JSON.stringify(report.improvement));
console.log(JSON.stringify(report.verifiedSkillReuse));

async function callModel(variant) {
  const startedAt = performance.now();
  const response = await fetch(`${modelBaseUrl}/chat/completions`, {
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
      max_tokens: variant.maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: variant.prompt },
        { role: "user", content: JSON.stringify(input) }
      ]
    })
  });
  if (!response.ok) {
    throw new Error(`${variant.name} model request failed: ${response.status}`);
  }
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${variant.name} returned no content`);
  const parsed = JSON.parse(extractJson(content));
  if (!Array.isArray(parsed.constraints)) {
    throw new Error(`${variant.name} returned no constraints`);
  }
  return {
    requestDurationMs: round(performance.now() - startedAt),
    constraintCount: parsed.constraints.length,
    hasNoSendRule: parsed.constraints.some(
      (constraint) =>
        constraint.kind === "must_not" &&
        /(?:send|发送)/i.test(
          `${constraint.statement || ""} ${constraint.sourceText || ""}`
        )
    ),
    hasCompensationRedaction: parsed.constraints.some(
      (constraint) =>
        constraint.kind === "redact" &&
        /(?:compensation|salary|薪资|薪酬)/i.test(
          `${constraint.statement || ""} ${constraint.sourceText || ""}`
        )
    ),
    constraints: parsed.constraints,
    metrics: payload.metrics
  };
}

async function requestJson(urlPath, options) {
  const response = await fetch(`${appBaseUrl}${urlPath}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers }
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      `${urlPath} failed: ${response.status} ${JSON.stringify(payload)}`
    );
  }
  return payload;
}

function summarize(results) {
  return {
    medianRequestDurationMs: median(
      results.map((result) => result.requestDurationMs)
    ),
    medianTtftMs: median(
      results.map((result) => result.metrics.ttftMs)
    ),
    medianGenerationMs: median(
      results.map((result) => result.metrics.generationMs)
    ),
    medianOutputTokens: median(
      results.map((result) => result.metrics.outputTokens)
    ),
    medianTokensPerSecond: median(
      results.map((result) => result.metrics.tokensPerSecond)
    ),
    semanticPass:
      results.every((result) => result.hasNoSendRule) &&
      results.every((result) => result.hasCompensationRedaction)
  };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : round((sorted[middle - 1] + sorted[middle]) / 2);
}

function percentageReduction(before, after) {
  return round(((before - after) / before) * 100);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function extractJson(content) {
  const trimmed = content.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start >= 0 && end > start
    ? trimmed.slice(start, end + 1)
    : trimmed;
}
