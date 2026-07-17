import type { DemoPreset } from "./types.js";

export const reviewFollowupDemo: DemoPreset = {
  projectName: "review-followup",
  scenario:
    "Turn a private project review into a safe follow-up package: prioritized findings, draft emails, tentative calendar holds, and an external audit report.",
  transcript:
    "After each project review, read the meeting note and only include P0 and P1 findings. Never include compensation data in the external report. Draft follow-up emails for each owner, but do not send them automatically. If an owner is missing, mark the item as needs confirmation instead of guessing. Create tentative calendar holds only when a due date is present. Replace every customer name with the approved account alias before writing the report.",
  actions: [
    {
      id: "act-1",
      type: "open_document",
      label: "Open private review note",
      timestampMs: 800
    },
    {
      id: "act-2",
      type: "filter_findings",
      label: "Keep P0 and P1 findings",
      timestampMs: 6200,
      payload: { severities: ["P0", "P1"] }
    },
    {
      id: "act-3",
      type: "select_commitment",
      label: "Resolve owner and due date",
      timestampMs: 11200
    },
    {
      id: "act-4",
      type: "draft_email",
      label: "Create owner follow-up drafts",
      timestampMs: 16900
    },
    {
      id: "act-5",
      type: "create_calendar_hold",
      label: "Create tentative due-date holds",
      timestampMs: 23500
    },
    {
      id: "act-6",
      type: "write_report",
      label: "Export redacted external audit report",
      timestampMs: 29800
    }
  ]
};
