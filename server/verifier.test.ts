import { describe, expect, it } from "vitest";
import { reviewFollowupDemo } from "../shared/demo.js";
import { compileSop } from "./compiler.js";
import { verifyCompilation } from "./verifier.js";

describe("proof verifier", () => {
  it("verifies the complete demo and issues governance receipts", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const result = await verifyCompilation(
      compilation,
      reviewFollowupDemo.actions
    );

    expect(result.status).toBe("verified");
    expect(result.fixtures.every((fixture) => fixture.status === "passed")).toBe(
      true
    );
    expect(result.receipts.some((receipt) => receipt.decision === "BLOCK")).toBe(
      true
    );
    expect(result.proofBundle).toHaveProperty("proofHash");
  });
});
