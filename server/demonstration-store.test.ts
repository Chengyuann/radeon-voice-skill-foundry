import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const commands = [
  "open",
  "filter",
  "confirm_missing_owner",
  "draft_emails",
  "create_holds",
  "export_report"
] as const;

describe("server-authoritative demonstration sessions", () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "rvsf-demonstration-"));
    process.env.RVSF_DATA_DIR = directory;
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.RVSF_DATA_DIR;
    await rm(directory, { recursive: true, force: true });
  });

  it("rejects out-of-order commands and persists a complete action contract", async () => {
    const {
      applyDemonstrationCommand,
      createDemonstrationSession,
      resolveDemonstrationSession
    } = await import("./demonstration-store.js");
    const created = await createDemonstrationSession();

    await expect(
      applyDemonstrationCommand(created.id, "draft_emails")
    ).rejects.toThrow("out of order");

    let session = created;
    for (const command of commands) {
      session = await applyDemonstrationCommand(session.id, command);
    }

    expect(session.complete).toBe(true);
    expect(session.state.events.map((event) => event.type)).toEqual([
      "open_document",
      "filter_findings",
      "select_commitment",
      "draft_email",
      "create_calendar_hold",
      "write_report"
    ]);
    expect(session.actionContractHash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      (await resolveDemonstrationSession(session.id, true)).actionContractHash
    ).toBe(session.actionContractHash);
  });

  it("invalidates completion after undo", async () => {
    const {
      applyDemonstrationCommand,
      createDemonstrationSession,
      resolveDemonstrationSession
    } = await import("./demonstration-store.js");
    let session = await createDemonstrationSession();
    for (const command of commands) {
      session = await applyDemonstrationCommand(session.id, command);
    }
    session = await applyDemonstrationCommand(session.id, "undo");

    expect(session.complete).toBe(false);
    await expect(
      resolveDemonstrationSession(session.id, true)
    ).rejects.toThrow("Complete the six-step demonstration");
  });
});
