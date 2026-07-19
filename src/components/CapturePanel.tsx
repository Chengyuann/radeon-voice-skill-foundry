import {
  AudioWaveform,
  CheckCircle2,
  FileAudio,
  Mic,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Square,
  Upload,
  WandSparkles
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { TranscribeResult } from "../../shared/types";
import type { DemonstrationState } from "../demonstration";
import { convertBlobToWav } from "../audio";
import { Magnet } from "../react-bits/Magnet";
import { SpotlightCard } from "../react-bits/SpotlightCard";
import { DemonstrationWorkspace } from "./DemonstrationWorkspace";
import { IconButton } from "./IconButton";

type CapturePanelProps = {
  projectName: string;
  scenario: string;
  transcript: string;
  demonstration: DemonstrationState;
  useModel: boolean;
  isBusy: boolean;
  isTranscribing: boolean;
  audioResult?: TranscribeResult;
  voiceEvidenceReviewed: boolean;
  transcriptEdited: boolean;
  onProjectName: (value: string) => void;
  onScenario: (value: string) => void;
  onTranscript: (value: string) => void;
  onUseModel: (value: boolean) => void;
  onVoiceEvidenceReviewed: (value: boolean) => void;
  onTranscribe: (audio: Blob) => Promise<void>;
  onDemonstration: (state: DemonstrationState) => void;
  onReset: () => void;
  onCompile: () => void;
};

export function CapturePanel({
  projectName,
  scenario,
  transcript,
  demonstration,
  useModel,
  isBusy,
  isTranscribing,
  audioResult,
  voiceEvidenceReviewed,
  transcriptEdited,
  onProjectName,
  onScenario,
  onTranscript,
  onUseModel,
  onVoiceEvidenceReviewed,
  onTranscribe,
  onDemonstration,
  onReset,
  onCompile
}: CapturePanelProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>();
  const recorderRef = useRef<MediaRecorder | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const chunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const useAudio = async (audio: Blob) => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(URL.createObjectURL(audio));
    await onTranscribe(audio);
  };

  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm"
      });
      void convertBlobToWav(blob).then(useAudio);
    };
    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.type === "audio/wav" || file.name.toLowerCase().endsWith(".wav")) {
      void useAudio(file);
      return;
    }
    void convertBlobToWav(file).then(useAudio);
  };

  return (
    <SpotlightCard
      as="section"
      className="workspace-panel capture-panel"
      spotlightColor="rgba(194, 58, 53, 0.07)"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Input stream</p>
          <h2>Voice SOP capture</h2>
        </div>
        <IconButton label="Reset demo" onClick={onReset}>
          <RotateCcw size={17} />
        </IconButton>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Skill name</span>
          <input
            value={projectName}
            onChange={(event) => onProjectName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Scenario</span>
          <textarea
            rows={3}
            value={scenario}
            onChange={(event) => onScenario(event.target.value)}
          />
        </label>
      </div>

      <div className="voice-recorder">
        <div className="voice-recorder-head">
          <div className="recording-state">
            <span className="record-dot" />
            SOP transcript
          </div>
          <span className="mono-meta">{transcript.length} chars</span>
        </div>
        <div className="audio-actions">
          <button
            className={`audio-action ${isRecording ? "audio-recording" : ""}`}
            type="button"
            disabled={isTranscribing}
            onClick={isRecording ? stopRecording : startRecording}
          >
            {isRecording ? <Square size={15} /> : <Mic size={15} />}
            {isRecording ? "Stop recording" : "Record SOP"}
          </button>
          <button
            className="audio-action"
            type="button"
            disabled={isRecording || isTranscribing}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={15} />
            Upload audio
          </button>
          <input
            ref={fileInputRef}
            className="audio-file-input"
            type="file"
            accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg"
            onChange={(event) => handleFile(event.target.files?.[0])}
          />
        </div>
        {audioUrl ? (
          <div className="audio-preview">
            <FileAudio size={15} />
            <audio controls src={audioUrl} />
          </div>
        ) : null}
        {audioResult ? (
          <div
            className={`voice-evidence voice-evidence-${audioResult.voiceEvidence.status}`}
          >
            <div className="voice-evidence-heading">
              <div>
                {audioResult.voiceEvidence.status === "pass" ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <ShieldAlert size={16} />
                )}
                <strong>Voice Evidence Gate</strong>
              </div>
              <span>{audioResult.voiceEvidence.qualityScore}/100</span>
            </div>
            <div className="voice-evidence-grid">
              <span>
                <small>RMS</small>
                <strong>
                  {audioResult.voiceEvidence.rmsDbfs?.toFixed(1) || "--"} dBFS
                </strong>
              </span>
              <span>
                <small>Clipping</small>
                <strong>
                  {(
                    (audioResult.voiceEvidence.clippingRatio || 0) * 100
                  ).toFixed(2)}
                  %
                </strong>
              </span>
              <span>
                <small>Silence</small>
                <strong>
                  {(
                    (audioResult.voiceEvidence.silenceRatio || 0) * 100
                  ).toFixed(1)}
                  %
                </strong>
              </span>
              <span>
                <small>Est. SNR</small>
                <strong>
                  {audioResult.voiceEvidence.estimatedSnrDb?.toFixed(1) || "--"}{" "}
                  dB
                </strong>
              </span>
              <span>
                <small>Noise floor</small>
                <strong>
                  {audioResult.voiceEvidence.noiseFloorDbfs?.toFixed(1) || "--"}{" "}
                  dBFS
                </strong>
              </span>
              <span>
                <small>Crest</small>
                <strong>
                  {audioResult.voiceEvidence.crestFactorDb?.toFixed(1) || "--"}{" "}
                  dB
                </strong>
              </span>
              <span>
                <small>Dropout</small>
                <strong>
                  {(
                    (audioResult.voiceEvidence.dropoutRatio || 0) * 100
                  ).toFixed(2)}
                  %
                </strong>
              </span>
              <span>
                <small>Burst loss</small>
                <strong>
                  {(
                    (audioResult.voiceEvidence.burstLossRatio || 0) * 100
                  ).toFixed(2)}
                  %
                </strong>
              </span>
              <span>
                <small>Source hash</small>
                <strong>
                  {audioResult.voiceEvidence.audioSha256.slice(0, 10)}
                </strong>
              </span>
            </div>
            {transcriptEdited ? (
              <p>The transcript differs from the server-bound ASR result.</p>
            ) : audioResult.voiceEvidence.issues.length ? (
              <p>{audioResult.voiceEvidence.issues[0]}</p>
            ) : (
              <p>
                Server-held v{audioResult.voiceEvidence.schemaVersion} evidence
                matches the ASR transcript.
              </p>
            )}
            {audioResult.voiceEvidence.diagnostics?.length ? (
              <div className="diagnostic-list">
                {audioResult.voiceEvidence.diagnostics.map((diagnostic) => (
                  <span key={diagnostic.code}>{diagnostic.message}</span>
                ))}
              </div>
            ) : (
              <div className="diagnostic-list diagnostic-clear">
                <span>No acoustic diagnostics triggered.</span>
              </div>
            )}
            {audioResult.voiceEvidence.status !== "quarantine" &&
            (audioResult.voiceEvidence.status === "review" ||
              transcriptEdited) ? (
              <label className="evidence-review-control">
                <input
                  type="checkbox"
                  checked={voiceEvidenceReviewed}
                  onChange={(event) =>
                    onVoiceEvidenceReviewed(event.target.checked)
                  }
                />
                <span>
                  I reviewed the current transcript against the source audio.
                </span>
              </label>
            ) : null}
          </div>
        ) : null}
        <textarea
          className="transcript-input"
          aria-label="Voice SOP transcript"
          value={transcript}
          onChange={(event) => onTranscript(event.target.value)}
        />
        <div className="waveform" aria-hidden="true">
          {Array.from({ length: 44 }, (_, index) => (
            <i
              key={index}
              style={
                {
                  "--bar": `${10 + ((index * 17) % 31)}px`,
                  "--delay": `${index * -31}ms`
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className="voice-note">
          <AudioWaveform size={15} />
          {isTranscribing
            ? "Qwen3-ASR is transcribing this audio on Radeon."
            : audioResult
              ? `${audioResult.language} · ${audioResult.audioSeconds.toFixed(
                  2
                )}s audio · RTF ${audioResult.rtf.toFixed(
                  4
                )} · ${audioResult.xRealtime.toFixed(2)}x real-time`
              : "Record or upload audio. The transcript will replace the SOP text and enable the Radeon model adapter."}
        </div>
      </div>

      <DemonstrationWorkspace
        state={demonstration}
        onState={onDemonstration}
      />

      <div className="trace-section">
        <div className="subheading-row">
          <h3>Captured action contract</h3>
          <span>{demonstration.events.length} events</span>
        </div>
        {demonstration.events.length ? (
          <ol className="action-trace">
            {demonstration.events.map((action, index) => (
              <li key={action.id}>
                <span className="trace-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <strong>{action.label}</strong>
                  <span>{(action.timestampMs / 1000).toFixed(1)}s</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="trace-empty">
            Run the workspace commands to produce a trusted demonstration
            contract.
          </p>
        )}
      </div>

      <div className="capture-footer">
        <label className="toggle-control">
          <input
            type="checkbox"
            checked={useModel}
            onChange={(event) => onUseModel(event.target.checked)}
          />
          <span className="toggle-track">
            <span />
          </span>
          <span>
            <strong>Radeon model adapter</strong>
            <small>Use configured OpenAI-compatible endpoint</small>
          </span>
        </label>
        <Magnet
          className="primary-magnet"
          disabled={isBusy}
          strength={10}
        >
          <button
            className="primary-button"
            disabled={isBusy || demonstration.events.length < 6}
            onClick={onCompile}
          >
            {isBusy ? <Sparkles size={17} /> : <WandSparkles size={17} />}
            {isTranscribing
              ? "Transcribing on Radeon"
              : isBusy
                ? "Compiling"
                : demonstration.events.length < 6
                  ? "Complete the demonstration"
                  : "Compile voice + actions"}
          </button>
        </Magnet>
      </div>
    </SpotlightCard>
  );
}
