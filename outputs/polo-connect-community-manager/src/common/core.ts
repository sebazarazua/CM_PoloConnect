import { createHash, randomUUID } from "node:crypto";

export type ErrorKind =
  | "retryable_error"
  | "permanent_error"
  | "blocked_input"
  | "validation_error"
  | "provider_error";
export class CMError extends Error {
  constructor(
    public kind: ErrorKind,
    message: string,
    public owner?: string,
  ) {
    super(message);
  }
}
export const id = (prefix: string) => `${prefix}_${randomUUID()}`;
export const now = () => new Date().toISOString();
export function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export const hash = (value: unknown) =>
  createHash("sha256").update(canonical(value)).digest("hex");
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        /secret|password|token|api.?key|authorization|database_url/i.test(k)
          ? "[REDACTED]"
          : redact(v),
      ]),
    );
  if (typeof value === "string")
    return value
      .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
      .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")
      .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED]");
  return value;
}
export function ensure(
  condition: unknown,
  message: string,
  owner?: string,
): asserts condition {
  if (!condition) throw new CMError("blocked_input", message, owner);
}
