import type { ActionEvent } from "../shared/types";

export type ReviewFinding = {
  id: string;
  severity: "P0" | "P1" | "P2";
  title: string;
  owner?: string;
  dueDate?: string;
  customerName: string;
  accountAlias: string;
  compensation?: string;
};

export type DemonstrationState = {
  events: ActionEvent[];
  startedAtMs?: number;
  nextSequence: number;
};

export type DemonstrationCommand =
  | { type: "open"; nowMs: number }
  | { type: "filter"; nowMs: number }
  | { type: "confirm_missing_owner"; nowMs: number }
  | { type: "draft_emails"; nowMs: number }
  | { type: "create_holds"; nowMs: number }
  | { type: "export_report"; nowMs: number }
  | { type: "undo" }
  | { type: "reset" };

export const reviewFindings: ReviewFinding[] = [
  {
    id: "F-184",
    severity: "P0",
    title: "Authentication retry loop blocks launch",
    owner: "Mira Chen",
    dueDate: "2026-07-24",
    customerName: "Northstar Mobility",
    accountAlias: "Account N7",
    compensation: "USD 184,000"
  },
  {
    id: "F-219",
    severity: "P1",
    title: "Audit export omits decision owner",
    dueDate: "2026-07-28",
    customerName: "Northstar Mobility",
    accountAlias: "Account N7"
  },
  {
    id: "F-261",
    severity: "P2",
    title: "Dashboard spacing differs at 125% zoom",
    owner: "Leon Varga",
    customerName: "Cinder Labs",
    accountAlias: "Account C4"
  }
];

export function createDemonstrationState(): DemonstrationState {
  return { events: [], nextSequence: 1 };
}

export function demonstrationReducer(
  state: DemonstrationState,
  command: DemonstrationCommand
): DemonstrationState {
  if (command.type === "reset") return createDemonstrationState();
  if (command.type === "undo") {
    const events = state.events.slice(0, -1);
    return {
      ...state,
      events,
      ...(events.length ? {} : { startedAtMs: undefined })
    };
  }

  const typeByCommand = {
    open: "open_document",
    filter: "filter_findings",
    confirm_missing_owner: "select_commitment",
    draft_emails: "draft_email",
    create_holds: "create_calendar_hold",
    export_report: "write_report"
  } as const;
  const eventType = typeByCommand[command.type];
  if (state.events.some((event) => event.type === eventType)) return state;

  const view = deriveDemonstration(state.events);
  if (!commandAllowed(command.type, view)) return state;
  const startedAtMs = state.startedAtMs ?? command.nowMs;
  const event = commandEvent(
    command.type,
    state.nextSequence,
    Math.max(0, Math.round(command.nowMs - startedAtMs))
  );
  return {
    events: [...state.events, event],
    startedAtMs,
    nextSequence: state.nextSequence + 1
  };
}

export function deriveDemonstration(events: ActionEvent[]) {
  const has = (type: ActionEvent["type"]) =>
    events.some((event) => event.type === type);
  const opened = has("open_document");
  const filtered = has("filter_findings");
  const ownerReviewed = has("select_commitment");
  const emailsDrafted = has("draft_email");
  const holdsCreated = has("create_calendar_hold");
  const reportExported = has("write_report");
  const visibleFindings = opened
    ? reviewFindings.filter(
        (finding) => !filtered || ["P0", "P1"].includes(finding.severity)
      )
    : [];
  const completedSteps = [
    opened,
    filtered,
    ownerReviewed,
    emailsDrafted,
    holdsCreated,
    reportExported
  ].filter(Boolean).length;
  return {
    opened,
    filtered,
    ownerReviewed,
    emailsDrafted,
    holdsCreated,
    reportExported,
    visibleFindings,
    completedSteps,
    totalSteps: 6,
    complete: completedSteps === 6
  };
}

function commandAllowed(
  type: Exclude<DemonstrationCommand["type"], "undo" | "reset">,
  view: ReturnType<typeof deriveDemonstration>
): boolean {
  switch (type) {
    case "open":
      return true;
    case "filter":
      return view.opened;
    case "confirm_missing_owner":
      return view.filtered;
    case "draft_emails":
      return view.ownerReviewed;
    case "create_holds":
      return view.emailsDrafted;
    case "export_report":
      return view.holdsCreated;
  }
}

function commandEvent(
  type: Exclude<DemonstrationCommand["type"], "undo" | "reset">,
  sequence: number,
  timestampMs: number
): ActionEvent {
  const id = `act-live-${sequence}`;
  switch (type) {
    case "open":
      return {
        id,
        type: "open_document",
        label: "Open private project review note",
        timestampMs,
        payload: { documentId: "review-july-17" }
      };
    case "filter":
      return {
        id,
        type: "filter_findings",
        label: "Keep P0 and P1 findings",
        timestampMs,
        payload: { severities: ["P0", "P1"], excluded: ["P2"] }
      };
    case "confirm_missing_owner":
      return {
        id,
        type: "select_commitment",
        label: "Mark F-219 as needs confirmation",
        timestampMs,
        payload: {
          findingId: "F-219",
          ownerState: "needs_confirmation",
          guessedOwner: false
        }
      };
    case "draft_emails":
      return {
        id,
        type: "draft_email",
        label: "Create owner follow-up drafts",
        timestampMs,
        payload: {
          findingIds: ["F-184", "F-219"],
          state: "draft",
          send: false
        }
      };
    case "create_holds":
      return {
        id,
        type: "create_calendar_hold",
        label: "Create tentative holds for dated findings",
        timestampMs,
        payload: {
          findingIds: ["F-184", "F-219"],
          tentative: true,
          committed: false
        }
      };
    case "export_report":
      return {
        id,
        type: "write_report",
        label: "Export redacted external audit report",
        timestampMs,
        payload: {
          path: "workspace/reports/review-followup.json",
          redactedFields: ["compensation", "customerName"],
          records: [
            {
              id: "F-184",
              customer: "Account N7",
              owner: "Mira Chen",
              dueDate: "2026-07-24"
            },
            {
              id: "F-219",
              customer: "Account N7",
              owner: "needs_confirmation",
              dueDate: "2026-07-28"
            }
          ]
        }
      };
  }
}
