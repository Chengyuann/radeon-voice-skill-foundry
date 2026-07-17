import { createHash, randomUUID } from "node:crypto";

export function id(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export function stableHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(sortObject(value)))
    .digest("hex");
}

export function textHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortObject(entry)])
    );
  }
  return value;
}
