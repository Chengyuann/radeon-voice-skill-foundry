import {
  CalendarClock,
  CheckCircle2,
  FileDown,
  FileText,
  Filter,
  Mail,
  RotateCcw,
  ShieldQuestion,
  Undo2
} from "lucide-react";
import {
  deriveDemonstration,
  type DemonstrationCommandType,
  type DemonstrationState
} from "../demonstration";
import { Badge } from "./Badge";

type DemonstrationWorkspaceProps = {
  state: DemonstrationState;
  isBusy: boolean;
  hasTrustedSession: boolean;
  onCommand: (type: DemonstrationCommandType) => void;
};

export function DemonstrationWorkspace({
  state,
  isBusy,
  hasTrustedSession,
  onCommand
}: DemonstrationWorkspaceProps) {
  const view = deriveDemonstration(state.events);

  return (
    <section className="demo-workspace" aria-label="Project review demonstration">
      <header className="demo-workspace-head">
        <div>
          <p className="eyebrow">Live demonstration</p>
          <h2>Project review workspace</h2>
        </div>
        <div className="demo-progress">
          <strong>
            {view.completedSteps}/{view.totalSteps}
          </strong>
          <span>{view.complete ? "trace complete" : "steps captured"}</span>
        </div>
      </header>

      <div className="demo-toolbar">
        <button
          type="button"
          disabled={isBusy || !hasTrustedSession || view.opened}
          onClick={() => onCommand("open")}
        >
          <FileText size={15} />
          Open review
        </button>
        <button
          type="button"
          disabled={isBusy || !view.opened || view.filtered}
          onClick={() => onCommand("filter")}
        >
          <Filter size={15} />
          P0/P1 only
        </button>
        <button
          type="button"
          disabled={isBusy || !view.filtered || view.ownerReviewed}
          onClick={() => onCommand("confirm_missing_owner")}
        >
          <ShieldQuestion size={15} />
          Review owner
        </button>
        <button
          type="button"
          disabled={isBusy || !view.ownerReviewed || view.emailsDrafted}
          onClick={() => onCommand("draft_emails")}
        >
          <Mail size={15} />
          Draft email
        </button>
        <button
          type="button"
          disabled={isBusy || !view.emailsDrafted || view.holdsCreated}
          onClick={() => onCommand("create_holds")}
        >
          <CalendarClock size={15} />
          Draft holds
        </button>
        <button
          type="button"
          disabled={isBusy || !view.holdsCreated || view.reportExported}
          onClick={() => onCommand("export_report")}
        >
          <FileDown size={15} />
          Export report
        </button>
      </div>

      <div className="demo-document">
        <div className="demo-document-title">
          <div>
            <span className="demo-document-icon">
              <FileText size={17} />
            </span>
            <span>
              <strong>July project review</strong>
              <small>Private note · 3 findings</small>
            </span>
          </div>
          <Badge tone={view.filtered ? "blue" : "neutral"}>
            {view.filtered ? "P0 / P1" : "unfiltered"}
          </Badge>
        </div>

        {!view.opened ? (
          <div className="demo-locked">
            <FileText size={22} />
            <strong>Open the private review to begin teaching.</strong>
            <span>Each command becomes a timestamped action event.</span>
          </div>
        ) : (
          <div className="finding-table">
            <div className="finding-row finding-row-head">
              <span>Severity</span>
              <span>Finding</span>
              <span>Owner</span>
              <span>Due</span>
              <span>Output</span>
            </div>
            {view.visibleFindings.map((finding) => {
              const needsConfirmation =
                finding.id === "F-219" && view.ownerReviewed;
              return (
                <div className="finding-row" key={finding.id}>
                  <Badge
                    tone={
                      finding.severity === "P0"
                        ? "red"
                        : finding.severity === "P1"
                          ? "amber"
                          : "neutral"
                    }
                  >
                    {finding.severity}
                  </Badge>
                  <span>
                    <strong>{finding.id}</strong>
                    <small>{finding.title}</small>
                  </span>
                  <span>
                    {finding.owner ||
                      (needsConfirmation
                        ? "needs confirmation"
                        : "unassigned")}
                  </span>
                  <code>{finding.dueDate || "--"}</code>
                  <span className="finding-output">
                    {view.reportExported ? finding.accountAlias : "private"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="demo-output-strip">
        <OutputState
          label="Email"
          active={view.emailsDrafted}
          value={view.emailsDrafted ? "2 drafts · 0 sent" : "not created"}
        />
        <OutputState
          label="Calendar"
          active={view.holdsCreated}
          value={view.holdsCreated ? "2 tentative · 0 committed" : "not created"}
        />
        <OutputState
          label="Report"
          active={view.reportExported}
          value={
            view.reportExported
              ? "2 aliased rows · compensation removed"
              : "not exported"
          }
        />
      </div>

      <footer className="demo-workspace-footer">
        <span>
          {view.complete ? (
            <>
              <CheckCircle2 size={14} />
              Demonstration contract captured
            </>
          ) : (
            "Complete the commands in order; irreversible actions stay disabled."
          )}
        </span>
        <div>
          <button
            type="button"
            className="demo-icon-command"
            disabled={isBusy || !hasTrustedSession || !state.events.length}
            onClick={() => onCommand("undo")}
            aria-label="Undo last demonstration action"
            title="Undo last action"
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            className="demo-icon-command"
            disabled={isBusy || !state.events.length}
            onClick={() => onCommand("reset")}
            aria-label="Reset demonstration workspace"
            title="Reset workspace"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </footer>
    </section>
  );
}

function OutputState({
  label,
  value,
  active
}: {
  label: string;
  value: string;
  active: boolean;
}) {
  return (
    <div className={active ? "demo-output-active" : ""}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}
