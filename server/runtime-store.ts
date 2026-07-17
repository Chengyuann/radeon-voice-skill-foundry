import type {
  ActionEvent,
  CompileResult,
  VerifyResult
} from "../shared/types.js";
import { dataFile, readStoredJson, updateStoredJson } from "./file-store.js";

export type TrustedCompileRun = {
  runId: string;
  compilation: CompileResult;
  actions: ActionEvent[];
  storedAt: string;
};

export type TrustedVerificationRun = {
  runId: string;
  compilation: CompileResult;
  actions: ActionEvent[];
  verification: VerifyResult;
  storedAt: string;
};

const compileRunsPath = () => dataFile("trusted-compile-runs.json");
const verificationRunsPath = () => dataFile("trusted-verification-runs.json");
const maxRecords = 100;

export async function storeCompileRun(
  compilation: CompileResult,
  actions: ActionEvent[]
): Promise<TrustedCompileRun> {
  const record: TrustedCompileRun = {
    runId: compilation.runId,
    compilation: structuredClone(compilation),
    actions: structuredClone(actions),
    storedAt: new Date().toISOString()
  };
  return updateStoredJson(compileRunsPath(), [], (records: TrustedCompileRun[]) => {
    const next = records.filter((item) => item.runId !== record.runId);
    next.push(record);
    records.splice(0, records.length, ...next.slice(-maxRecords));
    return structuredClone(record);
  });
}

export async function resolveCompileRun(
  runId: string
): Promise<TrustedCompileRun> {
  const records = await readStoredJson<TrustedCompileRun[]>(
    compileRunsPath(),
    []
  );
  const record = records.find((item) => item.runId === runId);
  if (!record) {
    throw new Error("Compilation run not found; compile the SOP again");
  }
  return structuredClone(record);
}

export async function storeVerificationRun(input: {
  compilation: CompileResult;
  actions: ActionEvent[];
  verification: VerifyResult;
}): Promise<TrustedVerificationRun> {
  const record: TrustedVerificationRun = {
    runId: input.compilation.runId,
    compilation: structuredClone(input.compilation),
    actions: structuredClone(input.actions),
    verification: structuredClone(input.verification),
    storedAt: new Date().toISOString()
  };
  return updateStoredJson(
    verificationRunsPath(),
    [],
    (records: TrustedVerificationRun[]) => {
      const next = records.filter((item) => item.runId !== record.runId);
      next.push(record);
      records.splice(0, records.length, ...next.slice(-maxRecords));
      return structuredClone(record);
    }
  );
}

export async function resolveVerificationRun(
  runId: string
): Promise<TrustedVerificationRun> {
  const records = await readStoredJson<TrustedVerificationRun[]>(
    verificationRunsPath(),
    []
  );
  const record = records.find((item) => item.runId === runId);
  if (!record) {
    throw new Error("Run not found; verify it first");
  }
  return structuredClone(record);
}

export async function runtimeRecordCounts(): Promise<{
  compileRuns: number;
  verificationRuns: number;
}> {
  const [compileRuns, verificationRuns] = await Promise.all([
    readStoredJson<TrustedCompileRun[]>(compileRunsPath(), []),
    readStoredJson<TrustedVerificationRun[]>(verificationRunsPath(), [])
  ]);
  return {
    compileRuns: compileRuns.length,
    verificationRuns: verificationRuns.length
  };
}
