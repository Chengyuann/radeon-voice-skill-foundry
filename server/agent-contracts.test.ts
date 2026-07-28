import { describe, expect, it } from "vitest";
import { reviewFollowupDemo } from "../shared/demo.js";
import { compileSop } from "./compiler.js";
import {
  contractHashes,
  createAgentHarnessContract,
  createAgentVerifierContract
} from "./agent-contracts.js";

describe("agent contracts", () => {
  it("builds deterministic server-authoritative harness and verifier contracts", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const harness = createAgentHarnessContract(reviewFollowupDemo.actions);
    const verifier = createAgentVerifierContract(compilation.fixtures);

    expect(harness.components.tools).toContainEqual(
      expect.objectContaining({
        actionType: "draft_email",
        capability: "mail:draft",
        authority: "server"
      })
    );
    expect(harness.components.sandbox.externalWritesAllowed).toBe(false);
    expect(harness.components.systemPolicy).toMatchObject({
      completionRule: "independent-verifier-only",
      preserveExistingGuardrails: true
    });
    expect(harness.components.subagents.enabled).toBe(false);
    expect(harness.budgets.maxConstraints).toBe(20);
    expect(verifier.completionAuthority).toBe("independent-verifier");
    expect(verifier.verifierIsolation).toBe("server-side");
    expect(verifier.hiddenChecksSupported).toBe(false);
    expect(verifier.repairPolicy.maxAttempts).toBe(2);
    expect(contractHashes({ harnessContract: harness, verifierContract: verifier }))
      .toEqual(
        contractHashes({
          harnessContract: compilation.harnessContract!,
          verifierContract: compilation.verifierContract!
        })
      );
  });
});
