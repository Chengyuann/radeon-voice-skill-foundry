import express from "express";
import Busboy from "busboy";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileRequestSchema,
  knowledgeDocumentInputSchema,
  knowledgeSearchSchema,
  refineRequestSchema
} from "../shared/schema.js";
import type {
  CompileRequest,
  CompileResult,
  VerifyRequest,
  VerifyResult
} from "../shared/types.js";
import { compileSop, refineCompilation } from "./compiler.js";
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
  listKnowledge,
  listSkills,
  markSkillReused,
  revalidateStoredSkill,
  saveVerifiedSkill,
  searchKnowledge
} from "./storage.js";

const app = express();
const port = Number(process.env.PORT || 8791);
const host = process.env.HOST || "127.0.0.1";
const maxAudioUploadBytes = 25 * 1024 * 1024;

app.use(express.json({ limit: "2mb" }));

app.get("/api/health", async (_request, response) => {
  response.json({
    ok: true,
    runtime: getRuntimeInfo(),
    persisted: {
      ...(await runtimeRecordCounts()),
      voiceEvidenceRecords: await voiceEvidenceRecordCount()
    }
  });
});

app.get("/api/runtime", (_request, response) => {
  response.json(getRuntimeInfo());
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

app.post("/api/compile", async (request, response) => {
  try {
    const input = compileRequestSchema.parse(request.body);
    const voiceRecord = input.voiceEvidenceId
      ? await resolveVoiceEvidence(input.voiceEvidenceId)
      : undefined;
    const compilation = await compileSop({
      ...input,
      ...(voiceRecord ? { voiceEvidence: voiceRecord.evidence } : {}),
      voiceTranscriptModified: voiceRecord
        ? !transcriptMatchesVoiceEvidence(voiceRecord.evidence, input.transcript)
        : false
    });
    await storeCompileRun(compilation, input.actions);
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
      compilation
    };
    await storeCompileRun(compilation, inferActionsForStoredSkill(compilation));
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
      result.skill.actions || inferActionsForStoredSkill(result.skill.compilation)
    );
    await storeVerificationRun({
      compilation: result.skill.compilation,
      actions:
        result.skill.actions || inferActionsForStoredSkill(result.skill.compilation),
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

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(currentDir, "../dist");
app.use(express.static(distDir));
app.get("/{*splat}", (_request, response) => {
  response.sendFile(path.join(distDir, "index.html"), (error) => {
    if (error) response.status(404).end();
  });
});

app.listen(port, host, () => {
  console.log(
    `Radeon Voice Skill Foundry API listening on http://${host}:${port}`
  );
});

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

function inferActionsForStoredSkill(
  compilation: CompileResult
): CompileRequest["actions"] {
  const actions = new Map<
    CompileRequest["actions"][number]["type"],
    CompileRequest["actions"][number]
  >();
  let timestampMs = 0;
  for (const permission of compilation.permissions) {
    const type = permissionToAction(permission.permission);
    if (!type || actions.has(type)) continue;
    actions.set(type, {
      id: id("action"),
      type,
      label: `Stored skill action: ${type}`,
      timestampMs
    });
    timestampMs += 1_000;
  }
  return actions.size
    ? [...actions.values()]
    : [
        {
          id: id("action"),
          type: "open_document",
          label: "Stored skill inspection",
          timestampMs: 0
        }
      ];
}

function permissionToAction(
  permission: string
): CompileRequest["actions"][number]["type"] | undefined {
  if (permission.startsWith("filesystem:read")) return "open_document";
  if (permission === "mail:draft") return "draft_email";
  if (permission === "mail:send") return "send_email";
  if (permission === "calendar:draft") return "create_calendar_hold";
  if (permission.startsWith("filesystem:write")) return "write_report";
  return undefined;
}
