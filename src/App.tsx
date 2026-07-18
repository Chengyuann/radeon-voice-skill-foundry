import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronRight } from "lucide-react";
import { reviewFollowupDemo } from "../shared/demo";
import type {
  ActionEvent,
  CompileResult,
  KnowledgeDocument,
    RuntimeInfo,
    SkillReuseResult,
    StoredSkill,
  TranscribeResult,
  VerifyResult
} from "../shared/types";
import {
  addKnowledge,
  compileSop,
  getRuntime,
  listKnowledge,
  listSkills,
  refineSop,
  revalidateSkill,
  reuseSkill,
  saveSkill,
  transcribeAudio,
  verifySop
} from "./api";
import { CapturePanel } from "./components/CapturePanel";
import { ConstraintPanel } from "./components/ConstraintPanel";
import { PerformanceStrip } from "./components/PerformanceStrip";
import { ProofPanel } from "./components/ProofPanel";
import { StepRail } from "./components/StepRail";
import { TopBar } from "./components/TopBar";
import { MemoryPanel } from "./components/MemoryPanel";
import { AnimatedContent } from "./react-bits/AnimatedContent";

export function App() {
  const [projectName, setProjectName] = useState(reviewFollowupDemo.projectName);
  const [scenario, setScenario] = useState(reviewFollowupDemo.scenario);
  const [transcript, setTranscript] = useState(reviewFollowupDemo.transcript);
  const [actions, setActions] = useState<ActionEvent[]>(
    reviewFollowupDemo.actions
  );
  const [useModel, setUseModel] = useState(false);
  const [runtime, setRuntime] = useState<RuntimeInfo>();
  const [compilation, setCompilation] = useState<CompileResult>();
  const [verification, setVerification] = useState<VerifyResult>();
  const [busy, setBusy] = useState<
    | "compile"
    | "verify"
    | "transcribe"
    | "refine"
    | "memory"
    | null
  >(null);
  const [error, setError] = useState<string>();
  const [audioResult, setAudioResult] = useState<TranscribeResult>();
  const [voiceEvidenceReviewed, setVoiceEvidenceReviewed] = useState(false);
  const [knowledge, setKnowledge] = useState<KnowledgeDocument[]>([]);
  const [skills, setSkills] = useState<StoredSkill[]>([]);
  const [savedSkillId, setSavedSkillId] = useState<string>();
  const [lastReuse, setLastReuse] = useState<SkillReuseResult>();

  const refreshRuntime = async () => {
    setRuntime(await getRuntime());
  };

  useEffect(() => {
    getRuntime().then(setRuntime).catch((requestError: Error) => {
      setError(requestError.message);
    });
  }, []);

  useEffect(() => {
    void Promise.all([listKnowledge(), listSkills()])
      .then(([documents, storedSkills]) => {
        setKnowledge(documents);
        setSkills(storedSkills);
      })
      .catch((requestError: Error) => setError(requestError.message));
  }, []);

  const status = useMemo(() => {
    if (verification?.status === "verified") return "verified" as const;
    if (verification?.status === "quarantined") return "quarantined" as const;
    if (compilation) return "compiled" as const;
    return "draft" as const;
  }, [compilation, verification]);

  const activeStep = verification
    ? 4
    : compilation
      ? busy === "verify"
        ? 3
        : 2
      : busy === "compile"
        ? 1
        : 0;

  const reset = () => {
    setProjectName(reviewFollowupDemo.projectName);
    setScenario(reviewFollowupDemo.scenario);
    setTranscript(reviewFollowupDemo.transcript);
    setActions(reviewFollowupDemo.actions);
    setUseModel(false);
    setCompilation(undefined);
    setVerification(undefined);
    setAudioResult(undefined);
    setVoiceEvidenceReviewed(false);
    setSavedSkillId(undefined);
    setLastReuse(undefined);
    setError(undefined);
  };

  const handleTranscribe = async (audio: Blob) => {
    setBusy("transcribe");
    setError(undefined);
    setCompilation(undefined);
    setVerification(undefined);
    setAudioResult(undefined);
    setVoiceEvidenceReviewed(false);
    try {
      const result = await transcribeAudio(audio);
      setAudioResult(result);
      setTranscript(result.transcript);
      setUseModel(true);
      setRuntime((current) => ({
        ...result.runtime,
        ...(current?.persisted ? { persisted: current.persisted } : {})
      }));
      await refreshRuntime();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Transcription failed"
      );
    } finally {
      setBusy(null);
    }
  };

  const handleCompile = async () => {
    setBusy("compile");
    setError(undefined);
    setVerification(undefined);
    try {
      const result = await compileSop({
        projectName,
        scenario,
        transcript,
        actions,
        useModel,
        voiceEvidenceId: audioResult?.voiceEvidenceId,
        voiceEvidenceReviewed
      });
      setCompilation(result);
      setSavedSkillId(undefined);
      await refreshRuntime();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Compilation failed"
      );
    } finally {
      setBusy(null);
    }
  };

  const handleTranscript = (value: string) => {
    setTranscript(value);
    if (audioResult && value !== audioResult.transcript) {
      setVoiceEvidenceReviewed(false);
    }
  };

  const handleRefine = async (message: string) => {
    if (!compilation) return;
    setBusy("refine");
    setError(undefined);
    setVerification(undefined);
    setSavedSkillId(undefined);
    try {
      const refined = await refineSop({
          compilation,
          message,
          actions,
          useModel
        });
      setCompilation(refined);
      await refreshRuntime();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Refinement failed"
      );
    } finally {
      setBusy(null);
    }
  };

  const handleSaveSkill = async () => {
    if (!verification) return;
    setBusy("memory");
    setError(undefined);
    try {
      const stored = await saveSkill(verification.runId);
      setSavedSkillId(stored.id);
      setLastReuse(undefined);
      setSkills(await listSkills());
      await refreshRuntime();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Skill save failed"
      );
    } finally {
      setBusy(null);
    }
  };

  const handleAddKnowledge = async (input: {
    title: string;
    content: string;
  }) => {
    setBusy("memory");
    setError(undefined);
    try {
      await addKnowledge(input);
      setKnowledge(await listKnowledge());
      await refreshRuntime();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Knowledge upload failed"
      );
    } finally {
      setBusy(null);
    }
  };

  const handleReuseSkill = async (skillId: string) => {
    setBusy("memory");
    setError(undefined);
    try {
      const reuse = await reuseSkill(skillId);
      const stored = reuse.skill;
      setProjectName(stored.compilation.projectName);
      setScenario(stored.compilation.scenario);
      setTranscript(
        stored.compilation.constraints
          .map((constraint) => constraint.sourceText)
          .join(" ")
      );
      setCompilation(stored.compilation);
      setAudioResult(undefined);
      setVoiceEvidenceReviewed(
        stored.compilation.voiceEvidenceReviewed || false
      );
      setVerification(undefined);
      setLastReuse(reuse);
      setSkills(await listSkills());
      await refreshRuntime();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Skill reuse failed"
      );
    } finally {
      setBusy(null);
    }
  };

  const handleRevalidateSkill = async (skillId: string) => {
    setBusy("memory");
    setError(undefined);
    try {
      const result = await revalidateSkill(skillId);
      setSkills(await listSkills());
      setCompilation(result.skill.compilation);
      setVerification(result.verification);
      setSavedSkillId(result.skill.id);
      setLastReuse(undefined);
      await refreshRuntime();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Skill revalidation failed"
      );
    } finally {
      setBusy(null);
    }
  };

  const handleVerify = async () => {
    if (!compilation) return;
    setBusy("verify");
    setError(undefined);
    try {
      const result = await verifySop(compilation, actions);
      setVerification(result);
      await refreshRuntime();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Verification failed"
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="app-shell">
      <TopBar runtime={runtime} status={status} />
      <main>
        <AnimatedContent className="context-strip">
          <div>
            <span>AMD AI DevMaster Hackathon</span>
            <ChevronRight size={14} />
            <strong>Track 2: Localized AI Agents Deployment</strong>
          </div>
          <p>
            One spoken SOP becomes an experimental GAIA skill, a capability
            manifest, adversarial fixtures, and a local proof package.
          </p>
        </AnimatedContent>
        <PerformanceStrip runtime={runtime} />
        <StepRail active={activeStep} />

        {error ? (
          <AnimatedContent className="error-banner" distance={8}>
            <AlertCircle size={17} />
            <span>{error}</span>
            <button onClick={() => setError(undefined)}>Dismiss</button>
          </AnimatedContent>
        ) : null}

        <div className="workspace-grid">
          <AnimatedContent className="workspace-motion capture-motion" delay={0.1}>
            <CapturePanel
              projectName={projectName}
              scenario={scenario}
              transcript={transcript}
              actions={actions}
              useModel={useModel}
              isBusy={busy === "compile" || busy === "transcribe"}
              isTranscribing={busy === "transcribe"}
              audioResult={audioResult}
              voiceEvidenceReviewed={voiceEvidenceReviewed}
              transcriptEdited={Boolean(
                audioResult && transcript !== audioResult.transcript
              )}
              onProjectName={setProjectName}
              onScenario={setScenario}
              onTranscript={handleTranscript}
              onUseModel={setUseModel}
              onVoiceEvidenceReviewed={setVoiceEvidenceReviewed}
              onTranscribe={handleTranscribe}
              onReset={reset}
              onCompile={handleCompile}
            />
          </AnimatedContent>
          <AnimatedContent className="workspace-motion constraint-motion" delay={0.16}>
            <ConstraintPanel
              compilation={compilation}
              verification={verification}
              isBusy={busy === "verify"}
              onVerify={handleVerify}
              onRefine={handleRefine}
              onSaveSkill={handleSaveSkill}
              isRefining={busy === "refine"}
              isSaving={busy === "memory"}
              savedSkillId={savedSkillId}
            />
          </AnimatedContent>
          <AnimatedContent className="workspace-motion proof-motion" delay={0.22}>
            <ProofPanel
              runtime={runtime}
              compilation={compilation}
              verification={verification}
            />
          </AnimatedContent>
        </div>
        <AnimatedContent delay={0.26}>
          <MemoryPanel
            documents={knowledge}
            matches={compilation?.ragMatches || []}
            skills={skills}
            lastReuse={lastReuse}
            isBusy={busy === "memory"}
            onAddKnowledge={handleAddKnowledge}
            onReuseSkill={handleReuseSkill}
            onRevalidateSkill={handleRevalidateSkill}
          />
        </AnimatedContent>
      </main>
    </div>
  );
}
