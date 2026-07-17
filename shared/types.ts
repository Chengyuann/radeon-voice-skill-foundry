export type ConstraintKind =
  | "must"
  | "must_not"
  | "only_if"
  | "unless"
  | "redact"
  | "requires_confirmation";

export type Constraint = {
  id: string;
  kind: ConstraintKind;
  statement: string;
  sourceText: string;
  confidence: number;
  appliesTo: string[];
};

export type ActionEvent = {
  id: string;
  type:
    | "open_document"
    | "filter_findings"
    | "select_commitment"
    | "draft_email"
    | "send_email"
    | "create_calendar_hold"
    | "write_report";
  label: string;
  timestampMs: number;
  payload?: Record<string, unknown>;
};

export type Permission = {
  id: string;
  permission: string;
  state: "allow" | "review" | "deny";
  reason: string;
};

export type TestFixture = {
  id: string;
  name: string;
  intent: string;
  expected: string;
  severity: "critical" | "high" | "medium";
  status?: "passed" | "failed";
  detail?: string;
  durationMs?: number;
};

export type RuntimeInfo = {
  mode: "deterministic" | "radeon";
  model: string;
  baseUrlConfigured: boolean;
  asrModel: string;
  gpu: string;
  rocm: string;
  asrRtf?: number;
  asrXRealtime?: number;
  asrPeakVramGiB?: number;
};

export type ModelMetrics = {
  ttftMs: number;
  generationMs: number;
  tokensPerSecond: number;
  inputTokens: number;
  outputTokens: number;
  peakVramGiB?: number;
};

export type CompileRequest = {
  projectName: string;
  scenario: string;
  transcript: string;
  actions: ActionEvent[];
  useModel?: boolean;
};

export type CompileResult = {
  runId: string;
  createdAt: string;
  projectName: string;
  scenario: string;
  constraints: Constraint[];
  permissions: Permission[];
  fixtures: TestFixture[];
  skillMarkdown: string;
  policyYaml: string;
  compileDurationMs: number;
  runtime: RuntimeInfo;
  modelMetrics?: ModelMetrics;
};

export type Receipt = {
  receiptId: string;
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  fixtureId: string;
  ruleIds: string[];
  payloadHash: string;
  createdAt: string;
};

export type VerificationMetric = {
  label: string;
  value: number | string;
  unit?: string;
  source: "measured" | "pending-radeon";
};

export type VerifyRequest = {
  compilation: CompileResult;
  actions: ActionEvent[];
};

export type VerifyResult = {
  runId: string;
  status: "verified" | "quarantined";
  fixtures: TestFixture[];
  receipts: Receipt[];
  metrics: VerificationMetric[];
  proofBundle: Record<string, unknown>;
  verificationDurationMs: number;
};

export type DemoPreset = {
  projectName: string;
  scenario: string;
  transcript: string;
  actions: ActionEvent[];
};
