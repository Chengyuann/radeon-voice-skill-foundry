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
  persisted?: {
    compileRuns: number;
    verificationRuns: number;
    voiceEvidenceRecords: number;
    demonstrationSessions: number;
  };
};

export type ModelMetrics = {
  ttftMs: number;
  generationMs: number;
  tokensPerSecond: number;
  inputTokens: number;
  outputTokens: number;
  peakVramGiB?: number;
};

export type ModelRoute = {
  selected: "primary" | "fallback";
  primaryAccepted: boolean;
  primaryReasons: string[];
};

export type KnowledgeDocument = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  source: "seed" | "user";
};

export type KnowledgeMatch = {
  documentId: string;
  title: string;
  excerpt: string;
  score: number;
};

export type RevisionPermissionChange = {
  permission: string;
  from?: Permission["state"];
  to: Permission["state"];
};

export type RevisionTurn = {
  revision: number;
  runId: string;
  parentRunId?: string;
  createdAt: string;
  instruction: string;
  status: "compiled" | "verified" | "quarantined";
  addedConstraints: string[];
  removedConstraints: string[];
  permissionChanges: RevisionPermissionChange[];
  fixtureCount: number;
};

export type CompileRequest = {
  projectName: string;
  scenario: string;
  transcript: string;
  actions: ActionEvent[];
  demonstrationSessionId?: string;
  useModel?: boolean;
  voiceEvidenceId?: string;
  voiceEvidenceReviewed?: boolean;
};

export type VoiceEvidenceStatus = "pass" | "review" | "quarantine";

export type AudioDiagnostic = {
  code:
    | "low_snr"
    | "dc_offset"
    | "dropout"
    | "burst_loss"
    | "channel_imbalance"
    | "low_dynamic_range";
  severity: "review" | "quarantine";
  message: string;
};

export type VoiceEvidence = {
  schemaVersion: "0.1.0" | "0.2.0" | "0.3.0";
  status: VoiceEvidenceStatus;
  qualityScore: number;
  format: string;
  sampleRateHz?: number;
  channels?: number;
  durationSeconds?: number;
  rmsDbfs?: number;
  peakDbfs?: number;
  clippingRatio?: number;
  silenceRatio?: number;
  noiseFloorDbfs?: number;
  speechLevelDbfs?: number;
  estimatedSnrDb?: number;
  dcOffset?: number;
  crestFactorDb?: number;
  dropoutRatio?: number;
  burstLossRatio?: number;
  channelImbalanceDb?: number;
  audioSha256: string;
  asrTranscriptSha256?: string;
  issues: string[];
  diagnostics?: AudioDiagnostic[];
  analyzedAt: string;
};

export type TranscribeResult = {
  transcript: string;
  language: string;
  audioSeconds: number;
  inferenceMs: number;
  rtf: number;
  xRealtime: number;
  peakVramGiB?: number;
  runtime: RuntimeInfo;
  voiceEvidence: VoiceEvidence;
  voiceEvidenceId: string;
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
  modelRoute?: ModelRoute;
  ragMatches?: KnowledgeMatch[];
  voiceEvidence?: VoiceEvidence;
  voiceEvidenceId?: string;
  voiceEvidenceReviewed?: boolean;
  voiceTranscriptModified?: boolean;
  revision?: number;
  parentRunId?: string;
  revisionHistory?: RevisionTurn[];
  demonstrationSessionId?: string;
};

export type Receipt = {
  receiptId: string;
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  fixtureId: string;
  ruleIds: string[];
  payloadHash: string;
  createdAt: string;
};

export type SandboxState = {
  documentOpen: boolean;
  visibleFindingIds: string[];
  ownerStates: Record<string, "needs_confirmation">;
  emailDrafts: Array<{
    findingId: string;
    state: "draft";
  }>;
  calendarHolds: Array<{
    findingId: string;
    dueDate: string;
    state: "tentative";
  }>;
  report?: {
    path: string;
    redactedFields: string[];
    records: Array<{
      id: string;
      customer: string;
      owner: string;
      dueDate?: string;
    }>;
  };
  externalEffects: {
    emailsSent: number;
    calendarCommitted: number;
    networkWrites: number;
  };
};

export type SandboxStep = {
  sequence: number;
  actionId: string;
  actionType: ActionEvent["type"];
  label: string;
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  status: "passed" | "failed";
  beforeHash: string;
  afterHash: string;
  changes: string[];
  output: string;
  durationMs: number;
};

export type SandboxProbe = {
  id: string;
  name: string;
  decision: "ALLOW" | "REVIEW" | "BLOCK";
  expected: string;
  passed: boolean;
  beforeHash: string;
  afterHash: string;
  stateUnchanged: boolean;
  detail: string;
};

export type SandboxReplay = {
  schemaVersion: "0.1.0";
  status: "passed" | "failed";
  initialHash: string;
  finalHash: string;
  steps: SandboxStep[];
  probes: SandboxProbe[];
  finalState: SandboxState;
  summary: {
    drafts: number;
    tentativeHolds: number;
    reportRecords: number;
    externalSideEffects: number;
  };
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

export type ProofCompatibilityManifest = {
  schemaVersion: "0.2.0" | "0.3.0" | "0.4.0";
  verifierVersion: string;
  runtimeHash: string;
  toolContractHash: string;
  policyHash: string;
  skillHash: string;
  voiceEvidenceSchemaVersion?: VoiceEvidence["schemaVersion"];
};

export type ProofCompatibility = {
  status: "compatible" | "revalidation_required";
  reasons: string[];
  checkedAt: string;
  expected?: ProofCompatibilityManifest;
  actual: ProofCompatibilityManifest;
};

export type SkillLifecycle =
  | "candidate"
  | "promoted"
  | "superseded"
  | "revoked";

export type SkillGovernanceReceipt = {
  receiptId: string;
  action: "PROMOTE" | "SUPERSEDE" | "REVOKE" | "ROLLBACK";
  skillId: string;
  proofHash: string;
  createdAt: string;
  reason?: string;
  sourceSkillId?: string;
  replacementSkillId?: string;
  reviewHash?: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
  riskAcknowledged?: boolean;
};

export type SkillPromotionReview = {
  schemaVersion: "0.1.0";
  skillId: string;
  name: string;
  candidateVersion: number;
  candidateProofHash: string;
  baseline?: {
    skillId: string;
    version: number;
    proofHash: string;
  };
  changes: {
    permissions: Array<{
      permission: string;
      change: "added" | "removed" | "changed";
      before?: Permission["state"];
      after?: Permission["state"];
    }>;
    constraints: Array<{
      kind: ConstraintKind;
      statement: string;
      change: "added" | "removed";
    }>;
    actions: Array<{
      type: ActionEvent["type"];
      change: "added" | "removed";
    }>;
    runtimeChanged: boolean;
  };
  risks: Array<{
    id: string;
    severity: "medium" | "high" | "critical";
    category: "permission" | "constraint" | "action";
    message: string;
  }>;
  riskLevel: "low" | "medium" | "high" | "critical";
  requiresRiskAcknowledgement: boolean;
  reviewHash: string;
};

export type GovernanceLedgerEntry = {
  schemaVersion: "0.1.0";
  sequence: number;
  previousHash: string;
  payloadHash: string;
  entryHash: string;
  receiptId: string;
  action: SkillGovernanceReceipt["action"];
  skillId: string;
  skillName: string;
  skillVersion: number;
  lifecycleAfter: SkillLifecycle;
  proofHash: string;
  createdAt: string;
  reason?: string;
  sourceSkillId?: string;
  replacementSkillId?: string;
  reviewHash?: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
  riskAcknowledged?: boolean;
};

export type GovernanceLedger = {
  schemaVersion: "0.1.0";
  status: "valid" | "invalid";
  entries: GovernanceLedgerEntry[];
  headHash: string;
  receiptCount: number;
  issues: string[];
  checkedAt: string;
};

export type StoredSkill = {
  id: string;
  name: string;
  version: number;
  status: "verified" | "revalidation_required";
  lifecycle: SkillLifecycle;
  createdAt: string;
  updatedAt: string;
  reuseCount: number;
  compilation: CompileResult;
  verification: VerifyResult;
  actions?: ActionEvent[];
  compatibility?: ProofCompatibility;
  governanceReceipts: SkillGovernanceReceipt[];
  promotedAt?: string;
  promotedProofHash?: string;
  revokedAt?: string;
  revocationReason?: string;
  supersededAt?: string;
  supersededBySkillId?: string;
  rollbackFromSkillId?: string;
};

export type DemonstrationSession = {
  id: string;
  state: import("./demonstration.js").DemonstrationState;
  complete: boolean;
  actionContractHash: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
};

export type SkillReuseResult = {
  skill: StoredSkill;
  reuseLatencyMs: number;
  httpRoundTripMs?: number;
  originalCompileDurationMs: number;
  speedup: number;
  httpSpeedup?: number;
  avoidedModelOutputTokens?: number;
  compatibility: ProofCompatibility;
};

export type SkillRevalidationResult = {
  skill: StoredSkill;
  verification: VerifyResult;
  compatibility: ProofCompatibility;
};

export type RefineRequest = {
  compilation: CompileResult;
  message: string;
  actions: ActionEvent[];
  useModel?: boolean;
};

export type DemoPreset = {
  projectName: string;
  scenario: string;
  transcript: string;
  actions: ActionEvent[];
};
