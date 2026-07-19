import { describe, expect, it } from "vitest";
import {
  createDemonstrationState,
  demonstrationReducer,
  deriveDemonstration
} from "./demonstration";

const commands = [
  "open",
  "filter",
  "confirm_missing_owner",
  "draft_emails",
  "create_holds",
  "export_report"
] as const;

describe("demonstration workspace", () => {
  it("captures the complete workflow from real commands", () => {
    const state = commands.reduce(
      (current, type, index) =>
        demonstrationReducer(current, {
          type,
          nowMs: 1_000 + index * 1_250
        }),
      createDemonstrationState()
    );
    expect(state.events.map((event) => event.type)).toEqual([
      "open_document",
      "filter_findings",
      "select_commitment",
      "draft_email",
      "create_calendar_hold",
      "write_report"
    ]);
    expect(state.events.map((event) => event.timestampMs)).toEqual([
      0, 1250, 2500, 3750, 5000, 6250
    ]);
    expect(deriveDemonstration(state.events).complete).toBe(true);
  });

  it("prevents out-of-order and duplicate events", () => {
    const initial = createDemonstrationState();
    expect(
      demonstrationReducer(initial, { type: "draft_emails", nowMs: 10 })
    ).toEqual(initial);
    const opened = demonstrationReducer(initial, { type: "open", nowMs: 10 });
    expect(
      demonstrationReducer(opened, { type: "open", nowMs: 20 })
    ).toEqual(opened);
  });

  it("excludes P2 and never commits irreversible side effects", () => {
    let state = createDemonstrationState();
    for (const [index, type] of commands.entries()) {
      state = demonstrationReducer(state, { type, nowMs: index * 1000 });
    }
    const view = deriveDemonstration(state.events);
    expect(view.visibleFindings.map((finding) => finding.severity)).toEqual([
      "P0",
      "P1"
    ]);
    const draft = state.events.find((event) => event.type === "draft_email");
    const holds = state.events.find(
      (event) => event.type === "create_calendar_hold"
    );
    expect(draft?.payload).toMatchObject({ state: "draft", send: false });
    expect(holds?.payload).toMatchObject({
      tentative: true,
      committed: false
    });
  });

  it("exports aliases without compensation and supports undo", () => {
    let state = createDemonstrationState();
    for (const [index, type] of commands.entries()) {
      state = demonstrationReducer(state, { type, nowMs: index * 1000 });
    }
    const report = state.events.find((event) => event.type === "write_report");
    expect(JSON.stringify(report?.payload)).not.toContain("184,000");
    expect(JSON.stringify(report?.payload)).not.toContain("Northstar Mobility");
    expect(JSON.stringify(report?.payload)).toContain("Account N7");

    state = demonstrationReducer(state, { type: "undo" });
    expect(deriveDemonstration(state.events).reportExported).toBe(false);
    expect(state.events).toHaveLength(5);
  });
});
