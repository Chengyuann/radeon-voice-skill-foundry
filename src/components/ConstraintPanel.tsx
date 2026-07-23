import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  CircleDot,
  CornerDownRight,
  FileWarning,
  Filter,
  GitBranch,
  LockKeyhole,
  MessageSquareText,
  Save,
  ShieldAlert,
  Sparkles,
  TestTubeDiagonal
} from "lucide-react";
import { useState } from "react";
import type {
  CompileResult,
  ConstraintKind,
  RevisionTurn,
  VerifyResult
} from "../../shared/types";
import { SpotlightCard } from "../react-bits/SpotlightCard";
import { Badge } from "./Badge";

const constraintIcons: Record<ConstraintKind, typeof Ban> = {
  must: Check,
  must_not: Ban,
  only_if: Filter,
  unless: AlertTriangle,
  redact: FileWarning,
  requires_confirmation: LockKeyhole
};

const suggestedCorrections = [
  "Always require confirmation before creating calendar holds.",
  "Never send drafted emails without explicit human approval.",
  "Redact customer identifiers from every external report."
];

type ConstraintPanelProps = {
  compilation?: CompileResult;
  verification?: VerifyResult;
  isBusy: boolean;
  onVerify: () => void;
  onRefine: (message: string) => Promise<void>;
  onSaveSkill: () => Promise<void>;
  isRefining: boolean;
  isSaving: boolean;
  savedSkillId?: string;
};

export function ConstraintPanel({
  compilation,
  verification,
  isBusy,
  onVerify,
  onRefine,
  onSaveSkill,
  isRefining,
  isSaving,
  savedSkillId
}: ConstraintPanelProps) {
  const [revision, setRevision] = useState("");
  const revisionNumber = compilation?.revision || 1;
  const revisionHistory = compilation
    ? resolveRevisionHistory(compilation, verification)
    : [];

  const submitRevision = async () => {
    const message = revision.trim();
    if (!message) return;
    await onRefine(message);
    setRevision("");
  };

  return (
    <SpotlightCard
      as="section"
      className="workspace-panel constraint-panel"
      spotlightColor="rgba(52, 95, 120, 0.065)"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Governed revision session</p>
          <h2>Multi-turn policy conversation</h2>
        </div>
        <Badge tone={compilation ? "blue" : "neutral"}>
          {compilation ? `${revisionNumber} turns` : "not started"}
        </Badge>
      </div>

      {!compilation ? (
        <div className="empty-state">
          <CircleDot size={22} />
          <strong>No compiled constraints</strong>
          <p>Compile the spoken SOP to generate enforceable rules.</p>
        </div>
      ) : (
        <>
          <div className="revision-session">
            <div className="revision-session-summary">
              <div>
                <GitBranch size={17} />
                <span>
                  <strong>{revisionHistory.length} governed turns</strong>
                  <small>Each correction creates an immutable child run</small>
                </span>
              </div>
              <div className="revision-session-route" aria-label="Revision route">
                {revisionHistory.map((turn, index) => (
                  <span
                    className={
                      index === revisionHistory.length - 1
                        ? "revision-route-current"
                        : ""
                    }
                    key={turn.runId}
                  >
                    v{turn.revision}
                  </span>
                ))}
              </div>
            </div>

            <ol className="revision-thread" aria-live="polite">
              {revisionHistory.map((turn, index) => {
                const isCurrent = index === revisionHistory.length - 1;
                return (
                  <li
                    className={`revision-turn ${
                      isCurrent ? "revision-turn-current" : ""
                    }`}
                    key={turn.runId}
                  >
                    <span className="revision-turn-rail" aria-hidden="true">
                      <i>{turn.revision}</i>
                    </span>
                    <div className="revision-turn-body">
                      <div className="revision-turn-heading">
                        <span>
                          <strong>
                            {turn.revision === 1
                              ? "Spoken baseline"
                              : `Operator correction ${turn.revision - 1}`}
                          </strong>
                          <small>
                            {turn.revision === 1
                              ? "Voice + demonstrated actions"
                              : "Natural-language policy instruction"}
                          </small>
                        </span>
                        <Badge tone={revisionStatusTone(turn.status)}>
                          {turn.status}
                        </Badge>
                      </div>

                      <p className="revision-message">{turn.instruction}</p>

                      <div className="revision-run-line">
                        {turn.parentRunId ? (
                          <>
                            <code>{shortRunId(turn.parentRunId)}</code>
                            <ArrowRight size={13} />
                          </>
                        ) : (
                          <span>root</span>
                        )}
                        <code>{shortRunId(turn.runId)}</code>
                        <strong>revision {turn.revision}</strong>
                      </div>

                      <div className="revision-delta-row">
                        <span className="revision-delta-add">
                          +{turn.addedConstraints.length} rules
                        </span>
                        <span>
                          -{turn.removedConstraints.length} rules
                        </span>
                        <span>
                          {turn.permissionChanges.length} capability changes
                        </span>
                        <span>{turn.fixtureCount} tests regenerated</span>
                      </div>

                      {isCurrent && turn.addedConstraints.length ? (
                        <div className="revision-result">
                          <CornerDownRight size={14} />
                          <span>
                            <small>Compiler response</small>
                            {turn.addedConstraints
                              .slice(0, 3)
                              .map((statement) => (
                                <strong key={statement}>{statement}</strong>
                              ))}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="revision-composer">
              <div className="revision-composer-heading">
                <span>
                  <MessageSquareText size={15} />
                  <strong>Continue the conversation</strong>
                </span>
                <small>creates revision {revisionNumber + 1}</small>
              </div>
              <textarea
                aria-label="Policy correction"
                placeholder="Correct or extend the policy in plain language..."
                value={revision}
                onChange={(event) => setRevision(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void submitRevision();
                  }
                }}
              />
              <div className="revision-suggestions" aria-label="Suggested corrections">
                {suggestedCorrections.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={() => setRevision(suggestion)}
                  >
                    <Sparkles size={12} />
                    {suggestion}
                  </button>
                ))}
              </div>
              <div className="revision-composer-actions">
                <span>
                  {verification ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <ShieldAlert size={14} />
                  )}
                  {verification
                    ? "Current revision has a proof"
                    : "Child revisions must be verified before use"}
                </span>
                <button
                  className="memory-reuse revision-submit"
                  disabled={!revision.trim() || isRefining}
                  onClick={submitRevision}
                >
                  <GitBranch size={14} />
                  {isRefining
                    ? "Compiling child revision"
                    : `Create revision ${revisionNumber + 1}`}
                </button>
              </div>
            </div>
          </div>

          <div className="policy-evidence-heading">
            <div>
              <p className="eyebrow">Current revision output</p>
              <h3>Learned constraints</h3>
            </div>
            <Badge tone="blue">{compilation.constraints.length} rules</Badge>
          </div>

          <div className="constraint-list">
            {compilation.constraints.map((constraint) => {
              const Icon = constraintIcons[constraint.kind];
              return (
                <article className="constraint-row" key={constraint.id}>
                  <div className={`constraint-icon constraint-${constraint.kind}`}>
                    <Icon size={16} strokeWidth={1.8} />
                  </div>
                  <div>
                    <div className="constraint-title">
                      <strong>{constraint.statement}</strong>
                      <span>{Math.round(constraint.confidence * 100)}%</span>
                    </div>
                    <p>{constraint.sourceText}</p>
                    <div className="tag-row">
                      <Badge tone="neutral">{constraint.kind}</Badge>
                      {constraint.appliesTo.map((action) => (
                        <span className="plain-tag" key={action}>
                          {action}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="permission-section">
            <div className="subheading-row">
              <h3>Capability manifest</h3>
              <span>least privilege</span>
            </div>
            <div className="permission-table">
              {compilation.permissions.map((permission) => (
                <div className="permission-row" key={permission.id}>
                  <code>{permission.permission}</code>
                  <Badge
                    tone={
                      permission.state === "allow"
                        ? "green"
                        : permission.state === "deny"
                          ? "red"
                          : "amber"
                    }
                  >
                    {permission.state}
                  </Badge>
                  <span>{permission.reason}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="test-section">
            <div className="subheading-row">
              <h3>Generated tests</h3>
              <span>{compilation.fixtures.length} fixtures</span>
            </div>
            <div className="test-list">
              {(verification?.fixtures || compilation.fixtures).map((fixture) => (
                <div className="test-row" key={fixture.id}>
                  <div>
                    <TestTubeDiagonal size={15} />
                    <strong>{fixture.name}</strong>
                  </div>
                  <Badge
                    tone={
                      fixture.status === "passed"
                        ? "green"
                        : fixture.status === "failed"
                          ? "red"
                          : "neutral"
                    }
                  >
                    {fixture.status || fixture.severity}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <button
            className="secondary-button verify-button"
            disabled={isBusy || Boolean(verification)}
            onClick={onVerify}
          >
            <TestTubeDiagonal size={17} />
            {verification
              ? verification.status === "verified"
                ? "Proof verified"
                : "Skill quarantined"
              : isBusy
                ? "Running sandbox"
                : "Run local verification"}
          </button>
          {verification?.status === "verified" ? (
            <button
              className="secondary-button save-skill-button"
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
        </>
      )}
    </SpotlightCard>
  );
}

function resolveRevisionHistory(
  compilation: CompileResult,
  verification?: VerifyResult
): RevisionTurn[] {
  const storedHistory = compilation.revisionHistory?.length
    ? compilation.revisionHistory
    : [
        {
          revision: compilation.revision || 1,
          runId: compilation.runId,
          parentRunId: compilation.parentRunId,
          createdAt: compilation.createdAt,
          instruction:
            (compilation.revision || 1) === 1
              ? "Initial spoken SOP"
              : "Imported policy revision",
          status: "compiled" as const,
          addedConstraints: compilation.constraints.map(
            (constraint) => constraint.statement
          ),
          removedConstraints: [],
          permissionChanges: compilation.permissions.map((permission) => ({
            permission: permission.permission,
            to: permission.state
          })),
          fixtureCount: compilation.fixtures.length
        }
      ];
  const history = storedHistory.some((turn) => turn.runId === compilation.runId)
    ? storedHistory
    : [
        ...storedHistory,
        {
          revision: compilation.revision || storedHistory.length + 1,
          runId: compilation.runId,
          parentRunId: compilation.parentRunId,
          createdAt: compilation.createdAt,
          instruction: "System revalidation or governance revision",
          status: "compiled" as const,
          addedConstraints: [],
          removedConstraints: [],
          permissionChanges: [],
          fixtureCount: compilation.fixtures.length
        }
      ];

  return history.map((turn) =>
    turn.runId === compilation.runId && verification
      ? { ...turn, status: verification.status }
      : turn
  );
}

function revisionStatusTone(
  status: RevisionTurn["status"]
): "neutral" | "green" | "red" | "blue" {
  if (status === "verified") return "green";
  if (status === "quarantined") return "red";
  return "blue";
}

function shortRunId(runId: string): string {
  if (runId.length <= 18) return runId;
  return `${runId.slice(0, 10)}...${runId.slice(-5)}`;
}
