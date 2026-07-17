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
  CompileResult,
  VerifyRequest,
  VerifyResult
} from "../shared/types.js";
import { compileSop, refineCompilation } from "./compiler.js";
import { buildSubmissionPackage } from "./package.js";
import { getRuntimeInfo } from "./runtime.js";
import { verifyCompilation } from "./verifier.js";
import { transcribeAudioBuffer } from "./transcriber.js";
import {
  addKnowledge,
  listKnowledge,
  listSkills,
  markSkillReused,
  saveVerifiedSkill,
  searchKnowledge
} from "./storage.js";

const app = express();
const port = Number(process.env.PORT || 8791);
const host = process.env.HOST || "127.0.0.1";
const results = new Map<
  string,
  { compilation: CompileResult; verification: VerifyResult }
>();

app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ ok: true, runtime: getRuntimeInfo() });
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
    const compilation = await compileSop(input);
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
    response.json(
      await refineCompilation({
        compilation: input.compilation as CompileResult,
        message: input.message,
        actions: input.actions,
        useModel: input.useModel
      })
    );
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
    const verification = await verifyCompilation(
      payload.compilation,
      payload.actions
    );
    results.set(payload.compilation.runId, {
      compilation: payload.compilation,
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
  const result = results.get(request.params.runId);
  if (!result) {
    response.status(404).json({ error: "Run not found; verify it first" });
    return;
  }
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
});

app.get("/api/skills", async (_request, response) => {
  response.json(await listSkills());
});

app.post("/api/skills/:runId", async (request, response) => {
  try {
    const result = results.get(request.params.runId);
    if (!result || result.verification.status !== "verified") {
      throw new Error("Verify this run before saving it as a skill");
    }
    const stored = await saveVerifiedSkill({
      name: result.compilation.projectName,
      status: "verified",
      compilation: result.compilation,
      verification: result.verification
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
    response.json(await markSkillReused(request.params.skillId));
  } catch (error) {
    response.status(404).json({
      error: error instanceof Error ? error.message : "Skill reuse failed"
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
    const busboy = Busboy({ headers: request.headers });
    const chunks: Buffer[] = [];
    let filename = "audio";
    let resolved = false;

    busboy.on("file", (_name, file, info) => {
      filename = info.filename || filename;
      file.on("data", (chunk: Buffer) => chunks.push(chunk));
      file.on("limit", () => reject(new Error("Audio upload too large")));
    });
    busboy.on("field", () => undefined);
    busboy.on("error", reject);
    busboy.on("finish", () => {
      if (resolved) return;
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
