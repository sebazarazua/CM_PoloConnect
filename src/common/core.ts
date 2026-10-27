import { createHash, randomUUID } from "node:crypto";

export type ErrorKind =
  | "retryable_error"
  | "permanent_error"
  | "blocked_input"
  | "validation_error"
  | "budget_exceeded"
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
        k === "api_key_configured" && typeof v === "boolean"
          ? v
          : /secret|password|api.?key|authorization|database_url|(?:access|refresh|auth|id)[_-]?token|private[_-]?key/i.test(
                k,
              ) ||
              /^(?:token|oauthCode|authorizationCode|session|cookie|signedUrl|mediaURL|credential|credentials)$/i.test(
                k,
              ) ||
              /encryption[_-]?key|aws[_-]?session|x-amz-/i.test(k)
            ? "[REDACTED]"
            : redact(v),
      ]),
    );
  if (typeof value === "string") {
    let safe = value;
    for (const name of [
      "OPENAI_API_KEY",
      "GEMINI_API_KEY",
      "GOOGLE_API_KEY",
      "INSTAGRAM_CLIENT_SECRET",
      "INSTAGRAM_ACCESS_TOKEN",
      "INSTAGRAM_TOKEN_ENCRYPTION_KEY",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
      "AWS_SESSION_TOKEN",
    ])
      if (process.env[name])
        safe = safe.replaceAll(process.env[name]!, "[REDACTED]");
    return safe
      .replace(
        /https:\/\/[^\s"<>]*[?&](?:X-Amz-Signature|X-Amz-Credential|access_token|client_secret)=[^\s"<>]*/gi,
        "[REDACTED_CREDENTIAL_URL]",
      )
      .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
      .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[REDACTED_DATABASE_URL]")
      .replace(/\bsk-[A-Za-z0-9_-]{16,}\b/g, "[REDACTED]");
  }
  return value;
}
export function ensure(
  condition: unknown,
  message: string,
  owner?: string,
): asserts condition {
  if (!condition) throw new CMError("blocked_input", message, owner);
}
