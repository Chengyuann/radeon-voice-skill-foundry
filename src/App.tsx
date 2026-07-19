import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { reviewFollowupDemo } from "../shared/demo";
import type {
  CompileResult,
  DemonstrationSession,
  KnowledgeDocument,
  RuntimeInfo,
  SkillReuseResult,
  StoredSkill,
  TranscribeResult,
  VerifyResult
} from "../shared/types";
import {
  createDemonstrationState,
  type DemonstrationCommandType,
  type DemonstrationState
} from "./demonstration";
import {
  addKnowledge,
  compileSop,
  createDemonstration,
  getRuntime,
  listKnowledge,
  listSkills,
  promoteSkill,
  refineSop,
  revalidateSkill,
  revokeSkill,
  rollbackSkill,
  runDemonstrationCommand,
  reuseSkill,
  saveSkill,
  transcribeAudio,
  verifySop
} from "./api";
import { CapturePanel } from "./components/CapturePanel";
import { CinematicHero } from "./components/CinematicHero";
import { ConstraintPanel } from "./components/ConstraintPanel";
import {
  type WorkbenchModule
} from "./components/ModuleDock";
import { ModuleWorkspace } from "./components/ModuleWorkspace";
import { ProofPanel } from "./components/ProofPanel";
import { TopBar } from "./components/TopBar";
import { MemoryPanel } from "./components/MemoryPanel";

export function App() {
  const reduceMotion = useReducedMotion();
  const [activeModule, setActiveModule] = useState<
    "cover" | WorkbenchModule
  >("cover");
  const [projectName, setProjectName] = useState(reviewFollowupDemo.projectName);
  const [scenario, setScenario] = useState(reviewFollowupDemo.scenario);
  const [transcript, setTranscript] = useState(reviewFollowupDemo.transcript);
  const [demonstration, setDemonstration] = useState<DemonstrationState>(
    createDemonstrationState
  );
  const [demonstrationSession, setDemonstrationSession] =
    useState<DemonstrationSession>();
  const [isDemonstrating, setIsDemonstrating] = useState(false);
  const actions = demonstration.events;
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
    void Promise.all([
      listKnowledge(),
      listSkills(),
      createDemonstration()
    ])
      .then(([documents, storedSkills, session]) => {
        setKnowledge(documents);
        setSkills(storedSkills);
        setDemonstrationSession(session);
        setDemonstration(session.state);
      })
      .catch((requestError: Error) => setError(requestError.message));
  }, []);

  const status = useMemo(() => {
    if (verification?.status === "verified") return "verified" as const;
    if (verification?.status === "quarantined") return "quarantined" as const;
    if (compilation) return "compiled" as const;
    return "draft" as const;
  }, [compilation, verification]);

  const reset = async () => {
    setProjectName(reviewFollowupDemo.projectName);
    setScenario(reviewFollowupDemo.scenario);
    setTranscript(reviewFollowupDemo.transcript);
    setDemonstration(createDemonstrationState());
    setDemonstrationSession(undefined);
    setUseModel(false);
    setCompilation(undefined);
    setVerification(undefined);
    setAudioResult(undefined);
    setVoiceEvidenceReviewed(false);
    setSavedSkillId(undefined);
    setLastReuse(undefined);
    setError(undefined);
    try {
      const session = await createDemonstration();
      setDemonstrationSession(session);
      setDemonstration(session.state);
      await refreshRuntime();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to start a trusted demonstration"
      );
    }
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
    if (actions.length < 6) {
      setError("Complete the six-step demonstration before compiling.");
      return;
    }
    setBusy("compile");
    setError(undefined);
    setVerification(undefined);
    try {
      const result = await compileSop({
        projectName,
        scenario,
        transcript,
        actions,
        demonstrationSessionId: demonstrationSession?.id,
        useModel,
        voiceEvidenceId: audioResult?.voiceEvidenceId,
        voiceEvidenceReviewed
      });
      setCompilation(result);
      setSavedSkillId(undefined);
      await refreshRuntime();
      setActiveModule("policy");
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
      setActiveModule("memory");
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
      setDemonstrationSession(undefined);
      setDemonstration({
        events: stored.actions || [],
        startedAtMs: undefined,
        nextSequence: (stored.actions?.length || 0) + 1
      });
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
      setDemonstrationSession(undefined);
      setDemonstration({
        events: result.skill.actions || [],
        startedAtMs: undefined,
        nextSequence: (result.skill.actions?.length || 0) + 1
      });
      setVerification(result.verification);
      setSavedSkillId(result.skill.id);
      setLastReuse(undefined);
      await refreshRuntime();
      setActiveModule("proof");
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

  const handlePromoteSkill = async (skillId: string) => {
    setBusy("memory");
    setError(undefined);
    try {
      await promoteSkill(skillId);
      setSkills(await listSkills());
      await refreshRuntime();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Skill promotion failed"
      );
    } finally {
      setBusy(null);
    }
  };

  const handleRevokeSkill = async (
    skillId: string,
    reason: string
  ) => {
    setBusy("memory");
    setError(undefined);
    try {
      await revokeSkill(skillId, reason);
      setLastReuse(undefined);
      setSkills(await listSkills());
      await refreshRuntime();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Skill revocation failed"
      );
    } finally {
      setBusy(null);
    }
  };

  const handleRollbackSkill = async (
    skillId: string,
    reason: string
  ) => {
    setBusy("memory");
    setError(undefined);
    try {
      const rolledBack = await rollbackSkill(skillId, reason);
      setCompilation(rolledBack.compilation);
      setVerification(rolledBack.verification);
      setSavedSkillId(rolledBack.id);
      setLastReuse(undefined);
      setSkills(await listSkills());
      await refreshRuntime();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Skill rollback failed"
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
      setActiveModule("proof");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Verification failed"
      );
    } finally {
      setBusy(null);
    }
  };

  const handleDemonstrationCommand = async (
    type: DemonstrationCommandType
  ) => {
    setIsDemonstrating(true);
    setError(undefined);
    try {
      let session = demonstrationSession;
      if (!session || type === "reset") {
        session = await createDemonstration();
        if (type === "reset") {
          setDemonstrationSession(session);
          setDemonstration(session.state);
          setCompilation(undefined);
          setVerification(undefined);
          setSavedSkillId(undefined);
          setLastReuse(undefined);
          await refreshRuntime();
          return;
        }
      }
      const updated = await runDemonstrationCommand(session.id, type);
      setDemonstrationSession(updated);
      setDemonstration(updated.state);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Demonstration command failed"
      );
      return;
    } finally {
      setIsDemonstrating(false);
    }
    setCompilation(undefined);
    setVerification(undefined);
    setSavedSkillId(undefined);
    setLastReuse(undefined);
    setError(undefined);
  };

  const openModule = (module: WorkbenchModule) => {
    setActiveModule(module);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activePanel =
    activeModule === "voice" ? (
      <CapturePanel
        projectName={projectName}
        scenario={scenario}
        transcript={transcript}
        demonstration={demonstration}
        demonstrationSession={demonstrationSession}
        useModel={useModel}
        isBusy={busy === "compile" || busy === "transcribe"}
        isTranscribing={busy === "transcribe"}
        isDemonstrating={isDemonstrating}
        hasTrustedDemonstration={Boolean(demonstrationSession)}
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
        onDemonstrationCommand={handleDemonstrationCommand}
        onReset={() => void reset()}
        onCompile={handleCompile}
      />
    ) : activeModule === "policy" ? (
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
    ) : activeModule === "proof" ? (
      <ProofPanel
        runtime={runtime}
        compilation={compilation}
        verification={verification}
        onSaveSkill={handleSaveSkill}
        isSaving={busy === "memory"}
        savedSkillId={savedSkillId}
      />
    ) : activeModule === "memory" ? (
      <MemoryPanel
        documents={knowledge}
        matches={compilation?.ragMatches || []}
        skills={skills}
        lastReuse={lastReuse}
        isBusy={busy === "memory"}
        onAddKnowledge={handleAddKnowledge}
        onReuseSkill={handleReuseSkill}
        onRevalidateSkill={handleRevalidateSkill}
        onPromoteSkill={handlePromoteSkill}
        onRevokeSkill={handleRevokeSkill}
        onRollbackSkill={handleRollbackSkill}
      />
    ) : null;

  return (
    <div className={`app-shell app-scene-${activeModule}`}>
      <TopBar runtime={runtime} status={status} />
      <AnimatePresence mode="wait" initial={false}>
        {activeModule === "cover" ? (
          <motion.div
            key="cover"
            initial={reduceMotion ? false : { opacity: 0, scale: 1.01 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            <CinematicHero onOpenModule={openModule} />
          </motion.div>
        ) : (
          <motion.div
            key="workspace"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            <ModuleWorkspace
              active={activeModule}
              runtime={runtime}
              status={status}
              error={error}
              onDismissError={() => setError(undefined)}
              onBack={() => setActiveModule("cover")}
              onSelect={openModule}
            >
              {activePanel}
            </ModuleWorkspace>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
