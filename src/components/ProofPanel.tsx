import {
  Braces,
  CheckCircle2,
  Download,
  FileCode2,
  Gauge,
  ListChecks,
  ReceiptText,
  Save,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";
import type {
  CompileResult,
  RuntimeInfo,
  SandboxReplay,
  VerifyResult
} from "../../shared/types";
import { SpotlightCard } from "../react-bits/SpotlightCard";
import { Badge } from "./Badge";

type ProofPanelProps = {
  runtime?: RuntimeInfo;
  compilation?: CompileResult;
  verification?: VerifyResult;
  isSaving?: boolean;
  savedSkillId?: string;
  onSaveSkill?: () => Promise<void>;
};

export function ProofPanel({
  runtime,
  compilation,
  verification,
  isSaving = false,
  savedSkillId,
  onSaveSkill
}: ProofPanelProps) {
  const sandboxReplay = verification?.proofBundle
    .sandboxReplay as SandboxReplay | undefined;
  const proxyPrefix =
    typeof window === "undefined"
      ? ""
      : window.location.pathname.match(
            /^(\/instances\/[^/]+\/proxy\/\d+)/
          )?.[1] || "";

  return (
    <SpotlightCard
      as="section"
      className="workspace-panel proof-panel"
      spotlightColor="rgba(47, 106, 79, 0.07)"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">GAIA artifact</p>
          <h2>Proof bundle</h2>
        </div>
        {verification ? (
          <Badge tone={verification.status === "verified" ? "green" : "red"}>
            {verification.status === "verified" ? (
              <CheckCircle2 size={13} />
            ) : (
              <ShieldAlert size={13} />
            )}
            {verification.status}
          </Badge>
        ) : (
          <Badge tone="neutral">not issued</Badge>
        )}
      </div>

      <div className="runtime-strip">
        <div>
          <Gauge size={16} />
          <span>
            <strong>{runtime?.mode === "radeon" ? "Radeon" : "Fallback"}</strong>
            <small>{runtime?.model || "Loading runtime"}</small>
          </span>
        </div>
        <div className="runtime-dot" data-active={runtime?.mode === "radeon"} />
      </div>

      {verification ? (
        <div className="proof-lifecycle">
          <div>
            <CheckCircle2 size={15} />
            <strong>Compatibility manifest</strong>
          </div>
          <span>
            verifier{" "}
            {String(
              (
                verification.proofBundle.compatibility as
                  | { verifierVersion?: string }
                  | undefined
              )?.verifierVersion || "legacy"
            )}
          </span>
          <code>
            persistent run · {verification.runId.slice(0, 12)}
          </code>
        </div>
      ) : null}

      <div className="artifact-tabs">
        <div className="artifact-tab active">
          <FileCode2 size={15} />
          SKILL.md
        </div>
        <div className="artifact-tab">
          <Braces size={15} />
          policy
        </div>
        <div className="artifact-tab">
          <ReceiptText size={15} />
          receipts
        </div>
      </div>

      <pre className="code-preview">
        <code>
          {compilation?.skillMarkdown ||
            `---
name: pending-voice-skill
metadata:
  gaia:
    security_tier: experimental
---

Compile the spoken SOP to preview
the GAIA-compatible skill artifact.`}
        </code>
      </pre>

      <div className="metric-section">
        <div className="subheading-row">
          <h3>Verification telemetry</h3>
          <span>measured + Radeon pending</span>
        </div>
        <div className="metric-grid">
          {(verification?.metrics || [
            {
              label: "Compile latency",
              value: "--",
              source: "measured" as const
            },
            {
              label: "Tests passed",
              value: "--",
              source: "measured" as const
            },
            {
              label: "Radeon TTFT",
              value: "Pending",
              source: "pending-radeon" as const
            },
            {
              label: "ASR RTF",
              value: "Pending",
              source: "pending-radeon" as const
            }
          ]).map((metric) => (
            <div
              className={`metric-item metric-${metric.source}`}
              key={metric.label}
            >
              <span>{metric.label}</span>
              <strong>
                {metric.value}
                {metric.unit ? <small>{metric.unit}</small> : null}
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="sandbox-section">
        <div className="subheading-row">
          <h3>Execution replay</h3>
          <span>
            {sandboxReplay
              ? `${sandboxReplay.steps.length} steps · ${sandboxReplay.probes.length} probes`
              : "awaiting verification"}
          </span>
        </div>
        {sandboxReplay ? (
          <>
            <div className="sandbox-summary">
              <div>
                <ListChecks size={15} />
                <span>
                  <strong>
                    {sandboxReplay.status === "passed"
                      ? "Replay complete"
                      : "Replay failed"}
                  </strong>
                  <small>
                    {sandboxReplay.summary.drafts} drafts ·{" "}
                    {sandboxReplay.summary.tentativeHolds} tentative ·{" "}
                    {sandboxReplay.summary.externalSideEffects} external
                  </small>
                </span>
              </div>
              <code>{sandboxReplay.finalHash.slice(0, 12)}</code>
            </div>
            <div className="sandbox-step-list">
              {sandboxReplay.steps.map((step) => (
                <div className="sandbox-step" key={step.actionId}>
                  <span className="sandbox-sequence">
                    {String(step.sequence).padStart(2, "0")}
                  </span>
                  <div>
                    <strong>{step.label}</strong>
                    <small>{step.output}</small>
                    <code>
                      {step.beforeHash.slice(0, 7)} →{" "}
                      {step.afterHash.slice(0, 7)}
                    </code>
                  </div>
                  <Badge
                    tone={
                      step.status === "failed"
                        ? "red"
                        : step.decision === "REVIEW"
                          ? "amber"
                          : step.decision === "BLOCK"
                            ? "red"
                            : "green"
                    }
                  >
                    {step.decision}
                  </Badge>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="receipt-empty">
            Sandbox steps appear after verification.
          </div>
        )}
      </div>

      <div className="probe-section">
        <div className="subheading-row">
          <h3>Adversarial probes</h3>
          <span>
            {sandboxReplay
              ? `${
                  sandboxReplay.probes.filter((probe) => probe.passed).length
                }/${sandboxReplay.probes.length} passed`
              : "fail closed"}
          </span>
        </div>
        <div className="probe-list">
          {sandboxReplay ? (
            sandboxReplay.probes.map((probe) => (
              <div className="probe-row" key={probe.id}>
                {probe.passed ? (
                  <ShieldCheck size={14} />
                ) : (
                  <ShieldAlert size={14} />
                )}
                <span>
                  <strong>{probe.name}</strong>
                  <small>{probe.detail}</small>
                </span>
                <Badge
                  tone={
                    probe.passed
                      ? probe.decision === "REVIEW"
                        ? "amber"
                        : "green"
                      : "red"
                  }
                >
                  {probe.decision}
                </Badge>
              </div>
            ))
          ) : (
            <div className="receipt-empty">
              Adversarial probes appear after verification.
            </div>
          )}
        </div>
      </div>

      <div className="receipt-section">
        <div className="subheading-row">
          <h3>Governance receipts</h3>
          <span>{verification?.receipts.length || 0} signed envelopes</span>
        </div>
        <div className="receipt-list">
          {verification?.receipts.length ? (
            verification.receipts.map((receipt) => (
              <div className="receipt-row" key={receipt.receiptId}>
                <Badge tone={receipt.decision === "BLOCK" ? "red" : "amber"}>
                  {receipt.decision}
                </Badge>
                <code>{receipt.payloadHash.slice(0, 12)}</code>
                <span>{receipt.ruleIds.length} rules</span>
              </div>
            ))
          ) : (
            <div className="receipt-empty">Receipts appear after verification.</div>
          )}
        </div>
      </div>

      <a
        className={`download-button ${verification ? "" : "download-disabled"}`}
        href={
          verification
            ? `${proxyPrefix}/api/package/${verification.runId}`
            : undefined
        }
        aria-disabled={!verification}
        onClick={(event) => {
          if (!verification) event.preventDefault();
        }}
      >
        <Download size={17} />
        Download proof package
      </a>
      {verification?.status === "verified" && onSaveSkill ? (
        <button
          className="secondary-button save-skill-button proof-save-button"
          disabled={isSaving || Boolean(savedSkillId)}
          onClick={onSaveSkill}
        >
          <Save size={17} />
          {savedSkillId
            ? "Saved as promotion candidate"
            : isSaving
              ? "Saving"
              : "Save verified candidate"}
        </button>
      ) : null}
    </SpotlightCard>
  );
}
