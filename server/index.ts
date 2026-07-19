import express from "express";
import Busboy from "busboy";
import { spawn } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileRequestSchema,
  demonstrationCommandSchema,
  knowledgeDocumentInputSchema,
  knowledgeSearchSchema,
  refineRequestSchema,
  skillPromotionApprovalSchema,
  skillGovernanceReasonSchema
} from "../shared/schema.js";
import type {
  CompileRequest,
  CompileResult,
  VerifyRequest,
  VerifyResult
} from "../shared/types.js";
import { compileSop, refineCompilation } from "./compiler.js";
import {
  applyDemonstrationCommand,
  createDemonstrationSession,
  demonstrationSessionCount,
  resolveDemonstrationSession
} from "./demonstration-store.js";
import { id } from "./hash.js";
import { buildSubmissionPackage } from "./package.js";
import { getRuntimeInfo } from "./runtime.js";
import {
  resolveCompileRun,
  resolveVerificationRun,
  runtimeRecordCounts,
  storeCompileRun,
  storeVerificationRun
} from "./runtime-store.js";
import { verifyCompilation } from "./verifier.js";
import { transcribeAudioBuffer } from "./transcriber.js";
import {
  resolveVoiceEvidence,
  transcriptMatchesVoiceEvidence,
  voiceEvidenceRecordCount
} from "./voice-evidence-store.js";
import {
  addKnowledge,
  getSkillPromotionReview,
  listKnowledge,
  listSkills,
  markSkillReused,
  promoteStoredSkill,
  revalidateStoredSkill,
  revokeStoredSkill,
  rollbackStoredSkill,
  resolveStoredSkillActions,
  saveVerifiedSkill,
  searchKnowledge
} from "./storage.js";

const app = express();
const port = Number(process.env.PORT || 8791);
const host = process.env.HOST || "127.0.0.1";
const maxAudioUploadBytes = 25 * 1024 * 1024;
let httpServer: ReturnType<typeof app.listen> | undefined;

app.use(express.json({ limit: "2mb" }));
app.use("/api", (request, response, next) => {
  const expected = process.env.RVSF_API_TOKEN?.trim();
  if (!expected) {
    next();
    return;
  }
  const provided = request.header("x-rvsf-api-token") || "";
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  if (
    expectedBytes.length !== providedBytes.length ||
    !timingSafeEqual(expectedBytes, providedBytes)
  ) {
    response.status(401).json({ error: "Unauthorized API request" });
    return;
  }
  next();
});

app.get("/api/health", async (_request, response) => {
  response.json({
    ok: true,
    runtime: getRuntimeInfo(),
    persisted: {
      ...(await runtimeRecordCounts()),
      voiceEvidenceRecords: await voiceEvidenceRecordCount(),
      demonstrationSessions: await demonstrationSessionCount()
    }
  });
});

app.get("/api/runtime", (_request, response) => {
  response.json(getRuntimeInfo());
});

app.post("/api/demo-control/restart", (request, response) => {
  if (process.env.RVSF_DEMO_CONTROL !== "1") {
    response.status(404).json({ error: "Demo control is disabled" });
    return;
  }
  const model =
    request.body &&
    typeof request.body === "object" &&
    "model" in request.body &&
    typeof request.body.model === "string"
      ? request.body.model.trim()
      : "";
  if (model.length < 2 || model.length > 160) {
    response.status(400).json({ error: "A valid runtime model is required" });
    return;
  }
  response.json({
    ok: true,
    action: "restart",
    nextModel: model,
    currentPid: process.pid
  });
  response.on("finish", () => scheduleDemoRestart(model));
});

app.post("/api/demo-control/shutdown", (_request, response) => {
  if (process.env.RVSF_DEMO_CONTROL !== "1") {
    response.status(404).json({ error: "Demo control is disabled" });
    return;
  }
  response.json({ ok: true, action: "shutdown", currentPid: process.pid });
  response.on("finish", () => scheduleDemoShutdown());
});

app.get("/api/knowledge", async (_request, response) => {
  response.json(await listKnowledge());
});

app.post("/api/knowledge", async (request, response) => {
  try {
    const input = knowledgeDocumentInputSchema.parse(request.body);
    response.status(201).json(await addKnowledge(input));
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Knowledge upload failed"
    });
  }
});

app.post("/api/knowledge/search", async (request, response) => {
  try {
    const input = knowledgeSearchSchema.parse(request.body);
    response.json(await searchKnowledge(input.query, input.limit));
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Knowledge search failed"
    });
  }
});

app.post("/api/demonstrations", async (_request, response) => {
  response.status(201).json(await createDemonstrationSession());
});

app.get("/api/demonstrations/:sessionId", async (request, response) => {
  try {
    response.json(
      await resolveDemonstrationSession(request.params.sessionId)
    );
  } catch (error) {
    response.status(404).json({
      error:
        error instanceof Error
          ? error.message
          : "Demonstration session lookup failed"
    });
  }
});

app.post(
  "/api/demonstrations/:sessionId/commands",
  async (request, response) => {
    try {
      const command = demonstrationCommandSchema.parse(request.body);
      response.json(
        await applyDemonstrationCommand(
          request.params.sessionId,
          command.type
        )
      );
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Demonstration command failed"
      });
    }
  }
);

app.post("/api/compile", async (request, response) => {
  try {
    const input = compileRequestSchema.parse(request.body);
    const demonstration = input.demonstrationSessionId
      ? await resolveDemonstrationSession(
          input.demonstrationSessionId,
          true
        )
      : undefined;
    const voiceRecord = input.voiceEvidenceId
      ? await resolveVoiceEvidence(input.voiceEvidenceId)
      : undefined;
    const compilation = await compileSop({
      ...input,
      actions: demonstration?.state.events || input.actions,
      ...(voiceRecord ? { voiceEvidence: voiceRecord.evidence } : {}),
      voiceTranscriptModified: voiceRecord
        ? !transcriptMatchesVoiceEvidence(voiceRecord.evidence, input.transcript)
        : false
    });
    await storeCompileRun(
      compilation,
      demonstration?.state.events || input.actions
    );
    response.json(compilation);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Compilation failed"
    });
  }
});

app.post("/api/refine", async (request, response) => {
  try {
    const input = refineRequestSchema.parse(request.body);
    const priorRun = await resolveCompileRun(input.compilation.runId);
    const compilation = await refineCompilation({
      compilation: priorRun.compilation,
      message: input.message,
      actions: priorRun.actions,
      useModel: input.useModel
    });
    await storeCompileRun(compilation, priorRun.actions);
    response.json(compilation);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Refinement failed"
    });
  }
});

app.post("/api/transcribe", async (request, response) => {
  try {
    const contentType = request.headers["content-type"];
    if (!contentType?.includes("multipart/form-data")) {
      throw new Error("Expected multipart/form-data audio upload");
    }

    const audio = await readAudioUpload(request);
    const result = await transcribeAudioBuffer(audio.buffer, audio.filename);
    response.json(result);
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error ? error.message : "Audio transcription failed"
    });
  }
});

app.post("/api/verify", async (request, response) => {
  try {
    const payload = request.body as VerifyRequest;
    if (!payload?.compilation?.runId || !Array.isArray(payload.actions)) {
      throw new Error("Invalid verification payload");
    }
    const trustedRun = await resolveCompileRun(payload.compilation.runId);
    const verification = await verifyCompilation(
      trustedRun.compilation,
      trustedRun.actions
    );
    await storeVerificationRun({
      compilation: trustedRun.compilation,
      actions: trustedRun.actions,
      verification
    });
    response.json(verification);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Verification failed"
    });
  }
});

app.get("/api/package/:runId", async (request, response) => {
  try {
    const result = await resolveVerificationRun(request.params.runId);
    const archive = await buildSubmissionPackage(
      result.compilation,
      result.verification
    );
    response
      .setHeader("Content-Type", "application/zip")
      .setHeader(
        "Content-Disposition",
        `attachment; filename="${result.compilation.projectName}-proof.zip"`
      )
      .send(archive);
  } catch {
    response.status(404).json({ error: "Run not found; verify it first" });
  }
});

app.get("/api/skills", async (_request, response) => {
  response.json(await listSkills());
});

app.post("/api/skills/:runId", async (request, response) => {
  try {
    const result = await resolveVerificationRun(request.params.runId);
    if (result.verification.status !== "verified") {
      throw new Error("Verify this run before saving it as a skill");
    }
    const stored = await saveVerifiedSkill({
      name: result.compilation.projectName,
      status: "verified",
      compilation: result.compilation,
      verification: result.verification,
      actions: result.actions
    });
    response.status(201).json(stored);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Skill save failed"
    });
  }
});

app.post("/api/skills/:skillId/reuse", async (request, response) => {
  try {
    const reuse = await markSkillReused(request.params.skillId);
    const compilation: CompileResult = {
      ...reuse.skill.compilation,
      runId: id("reuse"),
      createdAt: new Date().toISOString()
    };
    const skill = {
      ...reuse.skill,
      compilation,
      actions: resolveStoredSkillActions(reuse.skill)
    };
    await storeCompileRun(compilation, skill.actions);
    response.json({
      ...reuse,
      skill
    });
  } catch (error) {
    response.status(404).json({
      error: error instanceof Error ? error.message : "Skill reuse failed"
    });
  }
});

app.post("/api/skills/:skillId/revalidate", async (request, response) => {
  try {
    const result = await revalidateStoredSkill(request.params.skillId);
    await storeCompileRun(
      result.skill.compilation,
      resolveStoredSkillActions(result.skill)
    );
    await storeVerificationRun({
      compilation: result.skill.compilation,
      actions: resolveStoredSkillActions(result.skill),
      verification: result.verification
    });
    response.json(result);
  } catch (error) {
    response.status(400).json({
      error:
        error instanceof Error ? error.message : "Skill revalidation failed"
    });
  }
});

app.post("/api/skills/:skillId/promote", async (request, response) => {
  try {
    const input = skillPromotionApprovalSchema.parse(request.body);
    response.json(
      await promoteStoredSkill(request.params.skillId, input)
    );
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Skill promotion failed"
    });
  }
});

app.get(
  "/api/skills/:skillId/promotion-review",
  async (request, response) => {
    try {
      response.json(
        await getSkillPromotionReview(request.params.skillId)
      );
    } catch (error) {
      response.status(400).json({
        error:
          error instanceof Error
            ? error.message
            : "Promotion review failed"
      });
    }
  }
);

app.post("/api/skills/:skillId/revoke", async (request, response) => {
  try {
    const input = skillGovernanceReasonSchema.parse(request.body);
    response.json(
      await revokeStoredSkill(request.params.skillId, input.reason)
    );
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Skill revocation failed"
    });
  }
});

app.post("/api/skills/:skillId/rollback", async (request, response) => {
  try {
    const input = skillGovernanceReasonSchema.parse(request.body);
    const skill = await rollbackStoredSkill(
      request.params.skillId,
      input.reason
    );
    await storeCompileRun(
      skill.compilation,
      resolveStoredSkillActions(skill)
    );
    await storeVerificationRun({
      compilation: skill.compilation,
      actions: resolveStoredSkillActions(skill),
      verification: skill.verification
    });
    response.json(skill);
  } catch (error) {
    response.status(400).json({
      error: error instanceof Error ? error.message : "Skill rollback failed"
    });
  }
});

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(currentDir, "../dist");
app.use(express.static(distDir));
app.get("/{*splat}", (_request, response) => {
  response.sendFile(path.join(distDir, "index.html"), (error) => {
    if (error) response.status(404).end();
  });
});

httpServer = app.listen(port, host, () => {
  console.log(
    `Radeon Voice Skill Foundry API listening on http://${host}:${port}`
  );
});

function scheduleDemoRestart(model: string): void {
  setTimeout(() => {
    closeDemoServer(() => {
      const child = spawn(
        process.execPath,
        [...process.execArgv, ...process.argv.slice(1)],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            RADEON_MODEL: model,
            RVSF_DEMO_RESTART_COUNT: String(
              Number(process.env.RVSF_DEMO_RESTART_COUNT || 0) + 1
            )
          },
          detached: true,
          stdio: "ignore"
        }
      );
      child.unref();
      process.exit(0);
    });
  }, 100).unref();
}

function scheduleDemoShutdown(): void {
  setTimeout(() => {
    closeDemoServer(() => {
      const pidFile = process.env.RVSF_DEMO_TUNNEL_PID_FILE;
      if (pidFile) {
        try {
          const tunnelPid = Number(readFileSync(pidFile, "utf8").trim());
          if (Number.isInteger(tunnelPid) && tunnelPid > 1) {
            process.kill(tunnelPid, "SIGTERM");
          }
        } catch {
          // The isolated Tunnel already exited or its PID file is unavailable.
        }
      }
      process.exit(0);
    });
  }, 100).unref();
}

function closeDemoServer(onClosed: () => void): void {
  let completed = false;
  const finish = () => {
    if (completed) return;
    completed = true;
    onClosed();
  };
  if (!httpServer) {
    finish();
    return;
  }
  httpServer.close(finish);
  httpServer.closeIdleConnections?.();
  setTimeout(finish, 2_000).unref();
}

type UploadedAudio = {
  buffer: Buffer;
  filename: string;
};

function readAudioUpload(request: express.Request): Promise<UploadedAudio> {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: request.headers,
      limits: {
        fileSize: maxAudioUploadBytes,
        files: 1,
        fields: 0
      }
    });
    const chunks: Buffer[] = [];
    let filename = "audio";
    let resolved = false;
    let rejected = false;

    busboy.on("file", (_name, file, info) => {
      filename = info.filename || filename;
      file.on("data", (chunk: Buffer) => chunks.push(chunk));
      file.on("limit", () => {
        rejected = true;
        reject(new Error("Audio upload exceeds the 25 MB limit"));
      });
    });
    busboy.on("field", () => undefined);
    busboy.on("error", reject);
    busboy.on("finish", () => {
      if (resolved || rejected) return;
      resolved = true;
      const buffer = Buffer.concat(chunks);
      if (!buffer.length) {
        reject(new Error("No audio file uploaded"));
        return;
      }
      resolve({ buffer, filename });
    });
    request.pipe(busboy);
  });
}
