import {
  BookOpen,
  CircleCheckBig,
  Database,
  Download,
  History,
  ListChecks,
  Plus,
  RotateCw,
  ShieldAlert,
  Search,
  ShieldCheck,
  ShieldX,
  Square,
  SquareCheckBig,
  TriangleAlert,
  Zap
} from "lucide-react";
import { useState } from "react";
import type {
  GovernanceLedger,
  KnowledgeDocument,
  KnowledgeMatch,
  SkillReuseResult,
  SkillPromotionReview,
  StoredSkill
} from "../../shared/types";
import { Badge } from "./Badge";

type MemoryPanelProps = {
  documents: KnowledgeDocument[];
  matches: KnowledgeMatch[];
  skills: StoredSkill[];
  lastReuse?: SkillReuseResult;
  isBusy: boolean;
  onAddKnowledge: (input: { title: string; content: string }) => Promise<void>;
  onReuseSkill: (skillId: string) => Promise<void>;
  onRevalidateSkill: (skillId: string) => Promise<void>;
  onGetPromotionReview: (
    skillId: string
  ) => Promise<SkillPromotionReview>;
  onGetGovernanceLedger: () => Promise<GovernanceLedger>;
  governanceLedgerUrl: string;
  onPromoteSkill: (
    skillId: string,
    reviewHash: string,
    acknowledgeRisk: boolean
  ) => Promise<void>;
  onRevokeSkill: (skillId: string, reason: string) => Promise<void>;
  onRollbackSkill: (skillId: string, reason: string) => Promise<void>;
};

export function MemoryPanel({
  documents,
  matches,
  skills,
  lastReuse,
  isBusy,
  onAddKnowledge,
  onReuseSkill,
  onRevalidateSkill,
  onGetPromotionReview,
  onGetGovernanceLedger,
  governanceLedgerUrl,
  onPromoteSkill,
  onRevokeSkill,
  onRollbackSkill
}: MemoryPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [governanceSkillId, setGovernanceSkillId] = useState<string>();
  const [governanceAction, setGovernanceAction] = useState<
    "revoke" | "rollback"
  >();
  const [governanceReason, setGovernanceReason] = useState("");
  const [promotionReview, setPromotionReview] =
    useState<SkillPromotionReview>();
  const [promotionReviewLoading, setPromotionReviewLoading] =
    useState(false);
  const [riskAcknowledged, setRiskAcknowledged] = useState(false);
  const [governanceLedger, setGovernanceLedger] =
    useState<GovernanceLedger>();
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const submit = async () => {
    await onAddKnowledge({ title, content });
    setTitle("");
    setContent("");
    setShowAdd(false);
  };

  const submitGovernance = async () => {
    if (!governanceSkillId || !governanceAction) return;
    if (governanceAction === "revoke") {
      await onRevokeSkill(governanceSkillId, governanceReason.trim());
    } else {
      await onRollbackSkill(governanceSkillId, governanceReason.trim());
    }
    setGovernanceSkillId(undefined);
    setGovernanceAction(undefined);
    setGovernanceReason("");
  };

  const openPromotionReview = async (skillId: string) => {
    setPromotionReviewLoading(true);
    setRiskAcknowledged(false);
    try {
      setPromotionReview(await onGetPromotionReview(skillId));
    } finally {
      setPromotionReviewLoading(false);
    }
  };

  const submitPromotion = async () => {
    if (!promotionReview) return;
    await onPromoteSkill(
      promotionReview.skillId,
      promotionReview.reviewHash,
      riskAcknowledged
    );
    setPromotionReview(undefined);
    setRiskAcknowledged(false);
  };

  const toggleGovernanceLedger = async () => {
    if (governanceLedger) {
      setGovernanceLedger(undefined);
      return;
    }
    setLedgerLoading(true);
    try {
      setGovernanceLedger(await onGetGovernanceLedger());
    } finally {
      setLedgerLoading(false);
    }
  };

  return (
    <section className="memory-panel">
      <div className="memory-column">
        <div className="memory-heading">
          <div>
            <p className="eyebrow">Local retrieval</p>
            <h2>Policy knowledge</h2>
          </div>
          <button
            className="icon-button"
            title="Add policy document"
            aria-label="Add policy document"
            onClick={() => setShowAdd((value) => !value)}
          >
            <Plus size={17} />
          </button>
        </div>

        {showAdd ? (
          <div className="knowledge-form">
            <input
              placeholder="Document title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <textarea
              placeholder="Paste a local policy or SOP..."
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
            <button
              className="secondary-button"
              disabled={title.length < 2 || content.length < 20 || isBusy}
              onClick={submit}
            >
              <Database size={15} />
              Index locally
            </button>
          </div>
        ) : null}

        <div className="memory-list">
          {documents.map((document) => (
            <article key={document.id}>
              <BookOpen size={15} />
              <div>
                <strong>{document.title}</strong>
                <span>{document.source}</span>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="memory-column">
        <div className="memory-heading">
          <div>
            <p className="eyebrow">Retrieved context</p>
            <h2>Evidence used</h2>
          </div>
          <Badge tone={matches.length ? "blue" : "neutral"}>
            <Search size={12} />
            {matches.length}
          </Badge>
        </div>
        <div className="evidence-list">
          {matches.length ? (
            matches.map((match) => (
              <article key={match.documentId}>
                <div>
                  <strong>{match.title}</strong>
                  <code>{match.score.toFixed(3)}</code>
                </div>
                <p>{match.excerpt}</p>
              </article>
            ))
          ) : (
            <div className="memory-empty">Compile an SOP to retrieve policy evidence.</div>
          )}
        </div>
      </div>

      <div className="memory-column">
        <div className="memory-heading">
          <div>
            <p className="eyebrow">Procedural memory</p>
            <h2>Verified skills</h2>
          </div>
          <div className="memory-heading-actions">
            <button
              className="icon-button"
              title="Open governance audit ledger"
              aria-label="Open governance audit ledger"
              disabled={ledgerLoading}
              onClick={toggleGovernanceLedger}
            >
              <ListChecks size={16} />
            </button>
            <Badge tone={skills.length ? "green" : "neutral"}>
              <ShieldCheck size={12} />
              {skills.length}
            </Badge>
          </div>
        </div>
        {governanceLedger ? (
          <div className="governance-ledger">
            <div className="governance-ledger-head">
              <span>
                <strong>Governance audit ledger</strong>
                <small>
                  {governanceLedger.receiptCount} events · head{" "}
                  {governanceLedger.headHash.slice(0, 10)}
                </small>
              </span>
              <Badge
                tone={
                  governanceLedger.status === "valid" ? "green" : "red"
                }
              >
                {governanceLedger.status}
              </Badge>
            </div>
            {governanceLedger.issues.length ? (
              <div className="ledger-issues">
                {governanceLedger.issues.map((issue) => (
                  <span key={issue}>
                    <ShieldAlert size={12} />
                    {issue}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="ledger-entry-list">
              {governanceLedger.entries.length ? (
                governanceLedger.entries
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <div className="ledger-entry" key={entry.entryHash}>
                      <span className="ledger-sequence">
                        {String(entry.sequence).padStart(2, "0")}
                      </span>
                      <div>
                        <strong>
                          {entry.action} · {entry.skillName} v
                          {entry.skillVersion}
                        </strong>
                        <small>
                          {entry.lifecycleAfter} ·{" "}
                          {entry.entryHash.slice(0, 12)}
                        </small>
                      </div>
                      <Badge
                        tone={
                          entry.action === "REVOKE"
                            ? "red"
                            : entry.action === "SUPERSEDE"
                              ? "neutral"
                              : "green"
                        }
                      >
                        {entry.action}
                      </Badge>
                    </div>
                  ))
              ) : (
                <div className="memory-empty">
                  Governance events appear after promotion.
                </div>
              )}
            </div>
            <a
              className="ledger-download"
              href={governanceLedgerUrl}
              download="rvsf-governance-ledger.jsonl"
            >
              <Download size={13} />
              Export JSONL
            </a>
          </div>
        ) : null}
        <div className="skill-memory-list">
          {skills.length ? (
            skills
              .slice()
              .reverse()
              .map((skill) => (
                <article key={skill.id}>
                  <div>
                    <strong>{skill.name}</strong>
                    <span>
                      v{skill.version} · {skill.lifecycle}
                    </span>
                  </div>
                  <p>
                    {skill.compilation.constraints.length} rules · reused{" "}
                    {skill.reuseCount} times ·{" "}
                    {skill.status === "verified"
                      ? "proof compatible"
                      : "revalidation required"}
                  </p>
                  <div className="skill-governance-meta">
                    <Badge
                      tone={
                        skill.lifecycle === "promoted"
                          ? "green"
                          : skill.lifecycle === "revoked"
                            ? "red"
                            : skill.lifecycle === "candidate"
                              ? "blue"
                              : "neutral"
                      }
                    >
                      {skill.lifecycle}
                    </Badge>
                    <code>
                      {String(
                        skill.promotedProofHash ||
                          skill.verification.proofBundle.proofHash ||
                          ""
                      ).slice(0, 10)}
                    </code>
                    <span>
                      {skill.governanceReceipts.length} governance receipts
                    </span>
                  </div>
                  {lastReuse?.skill.id === skill.id ? (
                    <div className="reuse-benchmark">
                      <Zap size={12} />
                      <strong>
                        {(
                          lastReuse.httpRoundTripMs ??
                          lastReuse.reuseLatencyMs
                        ).toFixed(2)}{" "}
                        ms
                      </strong>
                      <span>
                        {(lastReuse.httpSpeedup ?? lastReuse.speedup) >= 1
                          ? `${(
                              lastReuse.httpSpeedup ?? lastReuse.speedup
                            ).toFixed(1)}x vs ${lastReuse.originalCompileDurationMs.toFixed(2)} ms`
                          : "exact verified lookup"}
                      </span>
                    </div>
                  ) : null}
                  {skill.compatibility?.reasons.length ? (
                    <div className="compatibility-warning">
                      <ShieldAlert size={13} />
                      <span>{skill.compatibility.reasons[0]}</span>
                    </div>
                  ) : null}
                  {governanceSkillId === skill.id ? (
                    <div className="skill-governance-form">
                      <textarea
                        placeholder={
                          governanceAction === "revoke"
                            ? "Why is this skill being revoked?"
                            : "Why should this historical version be restored?"
                        }
                        value={governanceReason}
                        onChange={(event) =>
                          setGovernanceReason(event.target.value)
                        }
                      />
                      <div>
                        <button
                          className="memory-reuse"
                          disabled={
                            governanceReason.trim().length < 4 || isBusy
                          }
                          onClick={submitGovernance}
                        >
                          {governanceAction === "revoke" ? (
                            <ShieldX size={13} />
                          ) : (
                            <History size={13} />
                          )}
                          Confirm {governanceAction}
                        </button>
                        <button
                          className="memory-reuse"
                          disabled={isBusy}
                          onClick={() => {
                            setGovernanceSkillId(undefined);
                            setGovernanceAction(undefined);
                            setGovernanceReason("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : promotionReview?.skillId === skill.id ? (
                    <div className="promotion-review">
                      <div className="promotion-review-head">
                        <span>
                          <strong>Promotion impact review</strong>
                          <small>
                            {promotionReview.baseline
                              ? `v${promotionReview.baseline.version} → v${promotionReview.candidateVersion}`
                              : `initial promotion · v${promotionReview.candidateVersion}`}
                          </small>
                        </span>
                        <Badge
                          tone={
                            promotionReview.riskLevel === "critical" ||
                            promotionReview.riskLevel === "high"
                              ? "red"
                              : promotionReview.riskLevel === "medium"
                                ? "amber"
                                : "green"
                          }
                        >
                          {promotionReview.riskLevel} risk
                        </Badge>
                      </div>
                      <div className="promotion-review-hash">
                        <span>review hash</span>
                        <code>
                          {promotionReview.reviewHash.slice(0, 16)}
                        </code>
                      </div>
                      <PromotionChanges review={promotionReview} />
                      {promotionReview.risks.length ? (
                        <div className="promotion-risk-list">
                          {promotionReview.risks.map((risk) => (
                            <div key={risk.id}>
                              <TriangleAlert size={13} />
                              <span>
                                <strong>{risk.severity}</strong>
                                <small>{risk.message}</small>
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="promotion-no-risk">
                          <ShieldCheck size={13} />
                          No capability or guardrail regression detected.
                        </div>
                      )}
                      {promotionReview.requiresRiskAcknowledgement ? (
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={riskAcknowledged}
                          className="promotion-risk-ack"
                          onClick={() =>
                            setRiskAcknowledged((value) => !value)
                          }
                        >
                          {riskAcknowledged ? (
                            <SquareCheckBig size={14} />
                          ) : (
                            <Square size={14} />
                          )}
                          <span>
                            I reviewed and accept the listed risk changes.
                          </span>
                        </button>
                      ) : null}
                      <div className="skill-governance-actions">
                        <button
                          className="memory-reuse governance-promote"
                          disabled={
                            isBusy ||
                            (promotionReview.requiresRiskAcknowledgement &&
                              !riskAcknowledged)
                          }
                          onClick={submitPromotion}
                        >
                          <CircleCheckBig size={13} />
                          Approve promotion
                        </button>
                        <button
                          className="memory-reuse"
                          disabled={isBusy}
                          onClick={() => {
                            setPromotionReview(undefined);
                            setRiskAcknowledged(false);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="skill-governance-actions">
                      {skill.status === "revalidation_required" &&
                      (skill.lifecycle === "candidate" ||
                        skill.lifecycle === "promoted") ? (
                        <button
                          className="memory-reuse"
                          disabled={isBusy}
                          onClick={() => onRevalidateSkill(skill.id)}
                        >
                          <RotateCw size={13} />
                          Revalidate
                        </button>
                      ) : skill.lifecycle === "candidate" ? (
                        <button
                          className="memory-reuse governance-promote"
                          disabled={isBusy || promotionReviewLoading}
                          onClick={() => openPromotionReview(skill.id)}
                        >
                          <CircleCheckBig size={13} />
                          {promotionReviewLoading
                            ? "Reviewing"
                            : "Review & promote"}
                        </button>
                      ) : skill.lifecycle === "promoted" ? (
                        <button
                          className="memory-reuse"
                          disabled={isBusy}
                          onClick={() => onReuseSkill(skill.id)}
                        >
                          <RotateCw size={13} />
                          Reuse
                        </button>
                      ) : (
                        <button
                          className="memory-reuse"
                          disabled={isBusy}
                          onClick={() => {
                            setGovernanceSkillId(skill.id);
                            setGovernanceAction("rollback");
                          }}
                        >
                          <History size={13} />
                          Rollback
                        </button>
                      )}
                      {(skill.lifecycle === "candidate" ||
                        skill.lifecycle === "promoted") &&
                      skill.status === "verified" ? (
                        <button
                          className="memory-reuse governance-revoke"
                          disabled={isBusy}
                          onClick={() => {
                            setGovernanceSkillId(skill.id);
                            setGovernanceAction("revoke");
                          }}
                        >
                          <ShieldX size={13} />
                          Revoke
                        </button>
                      ) : null}
                    </div>
                  )}
                </article>
              ))
          ) : (
            <div className="memory-empty">
              Verify and save a skill to create procedural memory.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PromotionChanges({
  review
}: {
  review: SkillPromotionReview;
}) {
  const changes = [
    ...review.changes.permissions.map((item) => ({
      label: item.permission,
      detail: `${item.before || "none"} → ${item.after || "removed"}`
    })),
    ...review.changes.constraints.map((item) => ({
      label: `${item.change} ${item.kind}`,
      detail: item.statement
    })),
    ...review.changes.actions.map((item) => ({
      label: `${item.change} action`,
      detail: item.type
    }))
  ];
  return (
    <div className="promotion-change-list">
      {changes.length ? (
        changes.map((change, index) => (
          <div key={`${change.label}-${index}`}>
            <strong>{change.label}</strong>
            <span>{change.detail}</span>
          </div>
        ))
      ) : (
        <div>
          <strong>No semantic changes</strong>
          <span>
            Policy, tools, and constraints match the promoted baseline.
          </span>
        </div>
      )}
      {review.changes.runtimeChanged ? (
        <div>
          <strong>Runtime changed</strong>
          <span>Model or Radeon runtime identity differs from baseline.</span>
        </div>
      ) : null}
    </div>
  );
}
