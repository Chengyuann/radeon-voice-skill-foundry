import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronRight } from "lucide-react";
import { reviewFollowupDemo } from "../shared/demo";
import type {
  ActionEvent,
  CompileResult,
  RuntimeInfo,
  TranscribeResult,
  VerifyResult
} from "../shared/types";
import { compileSop, getRuntime, transcribeAudio, verifySop } from "./api";
import { CapturePanel } from "./components/CapturePanel";
import { ConstraintPanel } from "./components/ConstraintPanel";
import { ProofPanel } from "./components/ProofPanel";
import { StepRail } from "./components/StepRail";
import { TopBar } from "./components/TopBar";

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
    "compile" | "verify" | "transcribe" | null
  >(null);
  const [error, setError] = useState<string>();
  const [audioResult, setAudioResult] = useState<TranscribeResult>();

  useEffect(() => {
    getRuntime().then(setRuntime).catch((requestError: Error) => {
      setError(requestError.message);
    });
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
    setError(undefined);
  };

  const handleTranscribe = async (audio: Blob) => {
    setBusy("transcribe");
    setError(undefined);
    setCompilation(undefined);
    setVerification(undefined);
    try {
      const result = await transcribeAudio(audio);
      setAudioResult(result);
      setTranscript(result.transcript);
      setUseModel(true);
      setRuntime(result.runtime);
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
        useModel
      });
      setCompilation(result);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Compilation failed"
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
        <div className="context-strip">
          <div>
            <span>AMD AI DevMaster Hackathon</span>
            <ChevronRight size={14} />
            <strong>Track 2: Localized AI Agents Deployment</strong>
          </div>
          <p>
            One spoken SOP becomes an experimental GAIA skill, a capability
            manifest, adversarial fixtures, and a local proof package.
          </p>
        </div>
        <StepRail active={activeStep} />

        {error ? (
          <div className="error-banner">
            <AlertCircle size={17} />
            <span>{error}</span>
            <button onClick={() => setError(undefined)}>Dismiss</button>
          </div>
        ) : null}

        <div className="workspace-grid">
          <CapturePanel
            projectName={projectName}
            scenario={scenario}
            transcript={transcript}
            actions={actions}
            useModel={useModel}
            isBusy={busy === "compile" || busy === "transcribe"}
            isTranscribing={busy === "transcribe"}
            audioResult={audioResult}
            onProjectName={setProjectName}
            onScenario={setScenario}
            onTranscript={setTranscript}
            onUseModel={setUseModel}
            onTranscribe={handleTranscribe}
            onReset={reset}
            onCompile={handleCompile}
          />
          <ConstraintPanel
            compilation={compilation}
            verification={verification}
            isBusy={busy === "verify"}
            onVerify={handleVerify}
          />
          <ProofPanel
            runtime={runtime}
            compilation={compilation}
            verification={verification}
          />
        </div>
      </main>
    </div>
  );
}
