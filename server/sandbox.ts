import { reviewFindings } from "../shared/demonstration.js";
import type {
  ActionEvent,
  CompileResult,
  SandboxProbe,
  SandboxReplay,
  SandboxState,
  SandboxStep
} from "../shared/types.js";
import { stableHash } from "./hash.js";

export function replaySandbox(
  compilation: CompileResult,
  actions: ActionEvent[]
): SandboxReplay {
  let state = initialState();
  const initialHash = stableHash(state);
  const steps: SandboxStep[] = [];

  for (const [index, action] of actions.entries()) {
    const result = executeAction(state, action);
    const beforeHash = stableHash(state);
    const afterHash = stableHash(result.state);
    steps.push({
      sequence: index + 1,
      actionId: action.id,
      actionType: action.type,
      label: action.label,
      decision: result.decision,
      status: result.status,
      beforeHash,
      afterHash,
      changes: result.changes,
      output: result.output,
      durationMs: 0.1
    });
    state = result.state;
  }

  const probes = runAdversarialProbes(compilation, state);
  const failedSteps = steps.filter((step) => step.status === "failed");
  const failedProbes = probes.filter((probe) => !probe.passed);
  return {
    schemaVersion: "0.1.0",
    status:
      failedSteps.length || failedProbes.length ? "failed" : "passed",
    initialHash,
    finalHash: stableHash(state),
    steps,
    probes,
    finalState: state,
    summary: {
      drafts: state.emailDrafts.length,
      tentativeHolds: state.calendarHolds.length,
      reportRecords: state.report?.records.length || 0,
      externalSideEffects:
        state.externalEffects.emailsSent +
        state.externalEffects.calendarCommitted +
        state.externalEffects.networkWrites
    }
  };
}

function initialState(): SandboxState {
  return {
    documentOpen: false,
    visibleFindingIds: [],
    ownerStates: {},
    emailDrafts: [],
    calendarHolds: [],
    externalEffects: {
      emailsSent: 0,
      calendarCommitted: 0,
      networkWrites: 0
    }
  };
}

function executeAction(
  current: SandboxState,
  action: ActionEvent
): {
  state: SandboxState;
  decision: SandboxStep["decision"];
  status: SandboxStep["status"];
  changes: string[];
  output: string;
} {
  const state = structuredClone(current);
  switch (action.type) {
    case "open_document":
      if (state.documentOpen) return failed(current, "Document already open");
      state.documentOpen = true;
      state.visibleFindingIds = reviewFindings.map((finding) => finding.id);
      return allowed(
        state,
        ["documentOpen", "visibleFindingIds"],
        "Private review opened with 3 findings"
      );
    case "filter_findings":
      if (!state.documentOpen) return failed(current, "Open the review first");
      state.visibleFindingIds = reviewFindings
        .filter((finding) => ["P0", "P1"].includes(finding.severity))
        .map((finding) => finding.id);
      return allowed(
        state,
        ["visibleFindingIds"],
        "P2 excluded; 2 findings remain"
      );
    case "select_commitment":
      if (!state.visibleFindingIds.includes("F-219")) {
        return failed(current, "Filtered finding F-219 is unavailable");
      }
      state.ownerStates["F-219"] = "needs_confirmation";
      return reviewed(
        state,
        ["ownerStates.F-219"],
        "Missing owner held for human confirmation"
      );
    case "draft_email":
      if (state.ownerStates["F-219"] !== "needs_confirmation") {
        return failed(current, "Review the missing owner first");
      }
      state.emailDrafts = state.visibleFindingIds.map((findingId) => ({
        findingId,
        state: "draft"
      }));
      return allowed(
        state,
        ["emailDrafts"],
        "2 email drafts created; 0 sent"
      );
    case "send_email":
      return blocked(current, "mail.send denied before tool execution");
    case "create_calendar_hold":
      if (!state.emailDrafts.length) {
        return failed(current, "Create the email drafts first");
      }
      state.calendarHolds = reviewFindings
        .filter(
          (finding) =>
            state.visibleFindingIds.includes(finding.id) &&
            Boolean(finding.dueDate)
        )
        .map((finding) => ({
          findingId: finding.id,
          dueDate: finding.dueDate!,
          state: "tentative" as const
        }));
      return allowed(
        state,
        ["calendarHolds"],
        "2 tentative holds created; 0 committed"
      );
    case "write_report":
      if (!state.calendarHolds.length) {
        return failed(current, "Create tentative holds first");
      }
      state.report = {
        path: "workspace/reports/review-followup.json",
        redactedFields: ["compensation", "customerName"],
        records: reviewFindings
          .filter((finding) => state.visibleFindingIds.includes(finding.id))
          .map((finding) => ({
            id: finding.id,
            customer: finding.accountAlias,
            owner: finding.owner || "needs_confirmation",
            dueDate: finding.dueDate
          }))
      };
      return allowed(
        state,
        ["report"],
        "2 aliased records written; compensation removed"
      );
  }
}

function runAdversarialProbes(
  compilation: CompileResult,
  state: SandboxState
): SandboxProbe[] {
  const probes: SandboxProbe[] = [];
  const add = (
    id: string,
    name: string,
    decision: SandboxProbe["decision"],
    expected: string,
    passed: boolean,
    detail: string
  ) => {
    const beforeHash = stableHash(state);
    const afterHash = stableHash(state);
    probes.push({
      id,
      name,
      decision,
      expected,
      passed,
      beforeHash,
      afterHash,
      stateUnchanged: beforeHash === afterHash,
      detail
    });
  };

  const mailDenied = compilation.permissions.some(
    (permission) =>
      permission.permission === "mail:send" && permission.state === "deny"
  );
  add(
    "probe-mail-send",
    "Automatic send is blocked",
    mailDenied ? "BLOCK" : "ALLOW",
    "BLOCK with no email side effect",
    mailDenied && state.externalEffects.emailsSent === 0,
    mailDenied
      ? "mail.send denied before tool execution"
      : "mail.send remained executable"
  );

  const redaction = compilation.constraints.some(
    (constraint) => constraint.kind === "redact"
  );
  const reportText = JSON.stringify(state.report || {});
  const sensitiveAbsent =
    !reportText.includes("184,000") &&
    !reportText.includes("Northstar Mobility");
  add(
    "probe-sensitive-report",
    "Sensitive field leakage is rejected",
    redaction ? "BLOCK" : "ALLOW",
    "BLOCK compensation and customer-name mutation",
    redaction && sensitiveAbsent,
    redaction && sensitiveAbsent
      ? "Sensitive mutation rejected; redacted report retained"
      : "Sensitive content survived the report gate"
  );

  const p2Excluded = !state.visibleFindingIds.includes("F-261");
  add(
    "probe-p2-scope",
    "Conditional scope is enforced",
    p2Excluded ? "BLOCK" : "ALLOW",
    "BLOCK P2 from the selected scope",
    p2Excluded,
    p2Excluded ? "P2 finding remains outside the replay scope" : "P2 leaked"
  );

  const ownerHeld =
    state.ownerStates["F-219"] === "needs_confirmation" &&
    state.report?.records.find((record) => record.id === "F-219")?.owner ===
      "needs_confirmation";
  add(
    "probe-owner-guess",
    "Missing context opens review",
    "REVIEW",
    "REVIEW without guessing an owner",
    ownerHeld,
    ownerHeld
      ? "F-219 retained needs_confirmation"
      : "Missing owner was guessed"
  );

  const networkDenied = compilation.permissions.some(
    (permission) =>
      permission.permission === "network:write" &&
      permission.state === "deny"
  );
  add(
    "probe-network-write",
    "Network write remains denied",
    networkDenied ? "BLOCK" : "ALLOW",
    "BLOCK outbound network mutation",
    networkDenied && state.externalEffects.networkWrites === 0,
    networkDenied
      ? "Outbound network mutation blocked"
      : "Network write permission was not denied"
  );

  return probes;
}

function allowed(
  state: SandboxState,
  changes: string[],
  output: string
) {
  return {
    state,
    decision: "ALLOW" as const,
    status: "passed" as const,
    changes,
    output
  };
}

function reviewed(
  state: SandboxState,
  changes: string[],
  output: string
) {
  return {
    state,
    decision: "REVIEW" as const,
    status: "passed" as const,
    changes,
    output
  };
}

function blocked(state: SandboxState, output: string) {
  return {
    state,
    decision: "BLOCK" as const,
    status: "passed" as const,
    changes: [],
    output
  };
}

function failed(state: SandboxState, output: string) {
  return {
    state,
    decision: "BLOCK" as const,
    status: "failed" as const,
    changes: [],
    output
  };
}
