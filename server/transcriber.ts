import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { TranscribeResult } from "../shared/types.js";
import { analyzeAudioEvidence } from "./audio-evidence.js";
import { id } from "./hash.js";
import { getRuntimeInfo } from "./runtime.js";
import { registerVoiceEvidence } from "./voice-evidence-store.js";

type RawTranscribeResult = Omit<
  TranscribeResult,
  "runtime" | "voiceEvidence" | "voiceEvidenceId"
>;

export async function transcribeAudioBuffer(
  buffer: Buffer,
  filename: string
): Promise<TranscribeResult> {
  const runtime = getRuntimeInfo();
  const voiceEvidence = analyzeAudioEvidence(buffer);
  const asrBaseUrl = process.env.RADEON_ASR_BASE_URL?.replace(/\/$/, "");
  const asrCommand = process.env.RADEON_ASR_COMMAND?.trim();
  if (!asrBaseUrl && !asrCommand) {
    throw new Error(
      "Radeon ASR is not configured. Set RADEON_ASR_COMMAND or run the Radeon model stack."
    );
  }

  const dir = path.join(tmpdir(), id("asr"));
  await mkdir(dir, { recursive: true });
  const inputPath = path.join(dir, sanitizeFilename(filename));
  await writeFile(inputPath, buffer);

  try {
    if (asrBaseUrl) {
      const response = await fetch(`${asrBaseUrl}/transcribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Filename": sanitizeFilename(filename)
        },
        body: new Uint8Array(buffer),
        signal: AbortSignal.timeout(180_000)
      });
      const payload = (await response.json()) as
        | RawTranscribeResult
        | { error?: string };
      if (!response.ok) {
        throw new Error(
          "error" in payload && payload.error
            ? payload.error
            : `Radeon ASR service failed with ${response.status}`
        );
      }
      const result = payload as RawTranscribeResult;
      const record = await registerVoiceEvidence(
        voiceEvidence,
        result.transcript
      );
      return {
        ...result,
        audioSeconds: voiceEvidence.durationSeconds ?? result.audioSeconds,
        runtime,
        voiceEvidence: record.evidence,
        voiceEvidenceId: record.id
      };
    }

    const command = asrCommand as string;
    const started = performance.now();
    const output = await runCommand(command, [inputPath]);
    const parsed = JSON.parse(output) as RawTranscribeResult;
    const record = await registerVoiceEvidence(
      voiceEvidence,
      parsed.transcript
    );
    return {
      ...parsed,
      audioSeconds: voiceEvidence.durationSeconds ?? parsed.audioSeconds,
      inferenceMs:
        typeof parsed.inferenceMs === "number"
          ? parsed.inferenceMs
          : Math.round(performance.now() - started),
      runtime,
      voiceEvidence: record.evidence,
      voiceEvidenceId: record.id
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const quotedArgs = args.map(shellQuote).join(" ");
    const child = spawn(`${command} ${quotedArgs}`, {
      shell: true,
      env: process.env,
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }
      reject(new Error(stderr.trim() || `ASR command exited with ${code}`));
    });
  });
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

function sanitizeFilename(filename: string): string {
  const clean = filename.replace(/[^a-zA-Z0-9_.-]+/g, "_");
  return clean || "audio.webm";
}
