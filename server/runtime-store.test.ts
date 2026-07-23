import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from "vitest";
import { reviewFollowupDemo } from "../shared/demo.js";
import { compileSop } from "./compiler.js";
import { verifyCompilation } from "./verifier.js";

describe("trusted runtime store", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "rvsf-runtime-store-"));
    process.env.RVSF_DATA_DIR = directory;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.RVSF_DATA_DIR;
    await rm(directory, { recursive: true, force: true });
  });

  it("recovers compile and verification runs after module reload", async () => {
    const compilation = await compileSop(reviewFollowupDemo);
    const verification = await verifyCompilation(
      compilation,
      reviewFollowupDemo.actions
    );
    const verifiedCompilation = {
      ...compilation,
      revisionHistory: compilation.revisionHistory?.map((turn) => ({
        ...turn,
        status: verification.status
      }))
    };
    const firstStore = await import("./runtime-store.js");
    await firstStore.storeCompileRun(
      verifiedCompilation,
      reviewFollowupDemo.actions
    );
    await firstStore.storeVerificationRun({
      compilation: verifiedCompilation,
      actions: reviewFollowupDemo.actions,
      verification
    });

    vi.resetModules();
    const reloadedStore = await import("./runtime-store.js");
    const restoredCompile = await reloadedStore.resolveCompileRun(
      compilation.runId
    );
    const restoredVerification =
      await reloadedStore.resolveVerificationRun(compilation.runId);

    expect(restoredCompile.compilation.projectName).toBe(
      compilation.projectName
    );
    expect(restoredCompile.compilation.revisionHistory?.[0].status).toBe(
      "verified"
    );
    expect(restoredVerification.verification.status).toBe("verified");
    expect(await reloadedStore.runtimeRecordCounts()).toEqual({
      compileRuns: 1,
      verificationRuns: 1
    });
  });
});
