import { describe, expect, it } from "vitest";
import { reviewFollowupDemo } from "../shared/demo.js";
import { compileSop } from "./compiler.js";
import { replaySandbox } from "./sandbox.js";

describe("deterministic sandbox replay", () => {
  it("replays the six-step workflow into a safe final state", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const replay = replaySandbox(compilation, reviewFollowupDemo.actions);

    expect(replay.status).toBe("passed");
    expect(replay.steps).toHaveLength(6);
    expect(replay.steps.every((step) => step.status === "passed")).toBe(true);
    expect(replay.probes).toHaveLength(5);
    expect(replay.probes.every((probe) => probe.passed)).toBe(true);
    expect(replay.summary).toEqual({
      drafts: 2,
      tentativeHolds: 2,
      reportRecords: 2,
      externalSideEffects: 0
    });
    expect(JSON.stringify(replay.finalState)).not.toContain("184,000");
    expect(JSON.stringify(replay.finalState)).not.toContain(
      "Northstar Mobility"
    );
  });

  it("fails closed when the action order is incomplete", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const replay = replaySandbox(compilation, [
      reviewFollowupDemo.actions[0],
      reviewFollowupDemo.actions[3]
    ]);

    expect(replay.status).toBe("failed");
    expect(replay.steps[1]).toMatchObject({
      actionType: "draft_email",
      decision: "BLOCK",
      status: "failed",
      changes: []
    });
    expect(replay.steps[1].beforeHash).toBe(replay.steps[1].afterHash);
  });

  it("fails the probes when a dangerous permission is promoted", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const unsafe = {
      ...compilation,
      permissions: compilation.permissions.map((permission) =>
        permission.permission === "mail:send"
          ? { ...permission, state: "allow" as const }
          : permission
      )
    };
    const replay = replaySandbox(unsafe, reviewFollowupDemo.actions);
    const probe = replay.probes.find(
      (item) => item.name === "Automatic send is blocked"
    );

    expect(replay.status).toBe("failed");
    expect(probe).toMatchObject({
      decision: "ALLOW",
      passed: false,
      stateUnchanged: true
    });
  });
});
