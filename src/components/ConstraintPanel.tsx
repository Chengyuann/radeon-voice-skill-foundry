import {
  AlertTriangle,
  Ban,
  Check,
  CircleDot,
  FileWarning,
  Filter,
  LockKeyhole,
  MessageSquareText,
  Save,
  TestTubeDiagonal
} from "lucide-react";
import { useState } from "react";
import type {
  CompileResult,
  ConstraintKind,
  VerifyResult
} from "../../shared/types";
import { Badge } from "./Badge";

const constraintIcons: Record<ConstraintKind, typeof Ban> = {
  must: Check,
  must_not: Ban,
  only_if: Filter,
  unless: AlertTriangle,
  redact: FileWarning,
  requires_confirmation: LockKeyhole
};

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

  const submitRevision = async () => {
    const message = revision.trim();
    if (!message) return;
    await onRefine(message);
    setRevision("");
  };

  return (
    <section className="workspace-panel constraint-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Policy compiler</p>
          <h2>Learned constraints</h2>
        </div>
        <Badge tone={compilation ? "blue" : "neutral"}>
          {compilation?.constraints.length || 0} rules
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

          <div className="revision-section">
            <div className="subheading-row">
              <h3>Multi-turn refinement</h3>
              <span>revision {compilation.revision || 1}</span>
            </div>
            <textarea
              placeholder="Add or correct a rule, e.g. Always ask before creating calendar holds."
              value={revision}
              onChange={(event) => setRevision(event.target.value)}
            />
            <button
              className="memory-reuse"
              disabled={!revision.trim() || isRefining}
              onClick={submitRevision}
            >
              <MessageSquareText size={14} />
              {isRefining ? "Recompiling" : "Apply revision"}
            </button>
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
                ? "Saved to skill memory"
                : isSaving
                  ? "Saving"
                  : "Save verified skill"}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
