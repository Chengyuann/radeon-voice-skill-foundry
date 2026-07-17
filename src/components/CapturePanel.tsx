import { Mic, RotateCcw, Sparkles, WandSparkles } from "lucide-react";
import type { ActionEvent } from "../../shared/types";
import { IconButton } from "./IconButton";

type CapturePanelProps = {
  projectName: string;
  scenario: string;
  transcript: string;
  actions: ActionEvent[];
  useModel: boolean;
  isBusy: boolean;
  onProjectName: (value: string) => void;
  onScenario: (value: string) => void;
  onTranscript: (value: string) => void;
  onUseModel: (value: boolean) => void;
  onReset: () => void;
  onCompile: () => void;
};

export function CapturePanel({
  projectName,
  scenario,
  transcript,
  actions,
  useModel,
  isBusy,
  onProjectName,
  onScenario,
  onTranscript,
  onUseModel,
  onReset,
  onCompile
}: CapturePanelProps) {
  return (
    <section className="workspace-panel capture-panel">
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
          <Mic size={15} />
          Recorded audio upload and Radeon ASR adapter are the next hardware
          milestone. The deterministic transcript path is active now.
        </div>
      </div>

      <div className="trace-section">
        <div className="subheading-row">
          <h3>Aligned action trace</h3>
          <span>{actions.length} events</span>
        </div>
        <ol className="action-trace">
          {actions.map((action, index) => (
            <li key={action.id}>
              <span className="trace-index">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{action.label}</strong>
                <span>{(action.timestampMs / 1000).toFixed(1)}s</span>
              </div>
            </li>
          ))}
        </ol>
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
        <button
          className="primary-button"
          disabled={isBusy}
          onClick={onCompile}
        >
          {isBusy ? <Sparkles size={17} /> : <WandSparkles size={17} />}
          {isBusy ? "Compiling" : "Compile spoken SOP"}
        </button>
      </div>
    </section>
  );
}
