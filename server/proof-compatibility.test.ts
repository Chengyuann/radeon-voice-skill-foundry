import { describe, expect, it } from "vitest";
import { reviewFollowupDemo } from "../shared/demo.js";
import { compileSop } from "./compiler.js";
import {
  assessProofCompatibility,
  createProofCompatibilityManifest
} from "./proof-compatibility.js";
import { verifyCompilation } from "./verifier.js";

describe("proof compatibility", () => {
  it("accepts an unchanged verified runtime and tool contract", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const verification = await verifyCompilation(
      compilation,
      reviewFollowupDemo.actions
    );

    expect(
      assessProofCompatibility({
        compilation,
        actions: reviewFollowupDemo.actions,
        verification,
        runtime: compilation.runtime
      }).status
    ).toBe("compatible");
  });

  it("requires revalidation when runtime or tools change", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const verification = await verifyCompilation(
      compilation,
      reviewFollowupDemo.actions
    );
    const compatibility = assessProofCompatibility({
      compilation,
      actions: [
        ...reviewFollowupDemo.actions,
        {
          id: "send-action",
          type: "send_email",
          label: "New send tool",
          timestampMs: 31_000
        }
      ],
      verification,
      runtime: {
        ...compilation.runtime,
        model: "different-model"
      }
    });

    expect(compatibility.status).toBe("revalidation_required");
    expect(compatibility.reasons.join(" ")).toMatch(/runtime|model/i);
    expect(compatibility.reasons.join(" ")).toMatch(/tool contract/i);
  });

  it("requires revalidation when the policy changes after proof", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const verification = await verifyCompilation(
      compilation,
      reviewFollowupDemo.actions
    );
    const changed = {
      ...compilation,
      policyYaml: `${compilation.policyYaml}\n# changed`
    };
    const compatibility = assessProofCompatibility({
      compilation: changed,
      actions: reviewFollowupDemo.actions,
      verification,
      runtime: changed.runtime
    });

    expect(compatibility.status).toBe("revalidation_required");
    expect(compatibility.reasons).toContain(
      "Stored policy changed after verification."
    );
  });

  it("uses the current compatibility schema", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    expect(
      createProofCompatibilityManifest(
        compilation,
        reviewFollowupDemo.actions
      ).schemaVersion
    ).toBe("0.2.0");
  });
});
