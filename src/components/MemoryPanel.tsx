import {
  BookOpen,
  Database,
  Plus,
  RotateCw,
  ShieldAlert,
  Search,
  ShieldCheck,
  Zap
} from "lucide-react";
import { useState } from "react";
import type {
  KnowledgeDocument,
  KnowledgeMatch,
  SkillReuseResult,
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
};

export function MemoryPanel({
  documents,
  matches,
  skills,
  lastReuse,
  isBusy,
  onAddKnowledge,
  onReuseSkill,
  onRevalidateSkill
}: MemoryPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const submit = async () => {
    await onAddKnowledge({ title, content });
    setTitle("");
    setContent("");
    setShowAdd(false);
  };

  return (
    <section className="memory-panel">
      <div className="memory-column">
        <div className="memory-heading">
          <div>
            <p className="eyebrow">Local RAG</p>
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
          <Badge tone={skills.length ? "green" : "neutral"}>
            <ShieldCheck size={12} />
            {skills.length}
          </Badge>
        </div>
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
                      v{skill.version} ·{" "}
                      {skill.status === "verified"
                        ? "proof compatible"
                        : "revalidation required"}
                    </span>
                  </div>
                  <p>
                    {skill.compilation.constraints.length} rules · reused{" "}
                    {skill.reuseCount} times
                  </p>
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
                  <button
                    className="memory-reuse"
                    disabled={isBusy}
                    onClick={() =>
                      skill.status === "verified"
                        ? onReuseSkill(skill.id)
                        : onRevalidateSkill(skill.id)
                    }
                  >
                    <RotateCw size={13} />
                    {skill.status === "verified" ? "Reuse" : "Revalidate"}
                  </button>
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
