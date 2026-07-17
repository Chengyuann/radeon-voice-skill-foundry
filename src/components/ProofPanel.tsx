import {
  Braces,
  CheckCircle2,
  Download,
  FileCode2,
  Gauge,
  ReceiptText,
  ShieldAlert
} from "lucide-react";
import type {
  CompileResult,
  RuntimeInfo,
  VerifyResult
} from "../../shared/types";
import { Badge } from "./Badge";

type ProofPanelProps = {
  runtime?: RuntimeInfo;
  compilation?: CompileResult;
  verification?: VerifyResult;
};

export function ProofPanel({
  runtime,
  compilation,
  verification
}: ProofPanelProps) {
  const proxyPrefix =
    typeof window === "undefined"
      ? ""
      : window.location.pathname.match(
            /^(\/instances\/[^/]+\/proxy\/\d+)/
          )?.[1] || "";

  return (
    <section className="workspace-panel proof-panel">
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
    </section>
  );
}
