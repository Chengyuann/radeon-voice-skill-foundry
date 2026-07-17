import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileRequestSchema } from "../shared/schema.js";
import type { CompileResult, VerifyRequest, VerifyResult } from "../shared/types.js";
import { compileSop } from "./compiler.js";
import { buildSubmissionPackage } from "./package.js";
import { getRuntimeInfo } from "./runtime.js";
import { verifyCompilation } from "./verifier.js";

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
