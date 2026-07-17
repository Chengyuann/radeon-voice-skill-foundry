import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

const writeQueues = new Map<string, Promise<unknown>>();

export function dataFile(name: string): string {
  return path.resolve(process.env.RVSF_DATA_DIR || ".rvsf-data", name);
}

export async function readStoredJson<T>(
  file: string,
  fallback: T
): Promise<T> {
  await mkdir(path.dirname(file), { recursive: true });
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeStoredJson(file, fallback);
    return structuredClone(fallback);
  }
}

export async function writeStoredJson(
  file: string,
  value: unknown
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2));
  await rename(temporary, file);
}

export async function updateStoredJson<T, Result>(
  file: string,
  fallback: T,
  update: (value: T) => Result | Promise<Result>
): Promise<Result> {
  const previous = writeQueues.get(file) || Promise.resolve();
  const next = previous.then(async () => {
    const value = await readStoredJson(file, fallback);
    const result = await update(value);
    await writeStoredJson(file, value);
    return result;
  });
  let queued: Promise<void>;
  queued = next
    .then(
      () => undefined,
      () => undefined
    )
    .finally(() => {
      if (writeQueues.get(file) === queued) writeQueues.delete(file);
    });
  writeQueues.set(file, queued);
  return next;
}
