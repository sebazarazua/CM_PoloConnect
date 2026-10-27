export type InstagramErrorCode =
  | "expired_token"
  | "missing_permission"
  | "media_url_inaccessible"
  | "container_failed"
  | "processing_timeout"
  | "rate_limit"
  | "network_failure"
  | "duplicate_publication"
  | "invalid_media"
  | "meta_api_error"
  | "publishing_disabled"
  | "stale_approval"
  | "reconciliation_required"
  | "busy";

export interface MetaDiagnostic {
  http_status: number;
  meta_error_type?: string;
  meta_error_code?: number;
  meta_error_subcode?: number;
  meta_error_message?: string;
}

/** Only these provider fields may reach diagnostics; never retain the raw body. */
export function sanitizeMetaDiagnostic(
  status: number,
  body: unknown,
  secrets: readonly string[] = [],
): MetaDiagnostic {
  const record = (value: unknown): Record<string, unknown> =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const outer = record(body);
  const source = outer.error ? record(outer.error) : outer;
  const responseSecrets: string[] = [];
  const collectSecrets = (value: unknown, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 10) return;
    for (const [key, entry] of Object.entries(value)) {
      if (
        /^(?:code|authorization[_-]?code|access[_-]?token|refresh[_-]?token|client[_-]?secret|authorization)$/i.test(
          key,
        ) &&
        typeof entry === "string"
      )
        responseSecrets.push(entry);
      else collectSecrets(entry, depth + 1);
    }
  };
  collectSecrets(body);
  const safeText = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    let safe = value;
    const sensitive = [
      ...secrets,
      ...responseSecrets,
      process.env.INSTAGRAM_CLIENT_SECRET,
      process.env.INSTAGRAM_ACCESS_TOKEN,
    ].filter((secret): secret is string => !!secret);
    for (const secret of sensitive.sort((a, b) => b.length - a.length)) {
      const form = new URLSearchParams({ v: secret }).toString().slice(2);
      for (const variant of new Set([
        secret,
        encodeURIComponent(secret),
        encodeURIComponent(encodeURIComponent(secret)),
        form,
        JSON.stringify(secret).slice(1, -1),
      ]))
        safe = safe.replaceAll(variant, "[REDACTED]");
    }
    return safe
      .replace(/https?:\/\/[^\s"'<>]+/gi, "[REDACTED_URL]")
      .replace(
        /\b(?:Authorization\s*[:=]\s*)?Bearer\s+[^\s,;"']+/gi,
        "[REDACTED_AUTHORIZATION]",
      )
      .replace(
        /(["']?(?:authorization[_ -]?code|code|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret|authorization)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi,
        "$1[REDACTED]",
      )
      .replace(/\b(?:IGAA|IGQV|EAA)[A-Za-z0-9_-]+\b/g, "[REDACTED]")
      .replace(/\p{Cc}/gu, " ")
      .slice(0, 500);
  };
  const number = (value: unknown) =>
    typeof value === "number" && Number.isSafeInteger(value)
      ? value
      : undefined;
  return {
    http_status: status,
    meta_error_type: safeText(
      source.type ?? source.error_type ?? source.meta_error_type,
    ),
    meta_error_code: number(source.code ?? source.meta_error_code),
    meta_error_subcode: number(
      source.error_subcode ?? source.meta_error_subcode,
    ),
    meta_error_message: safeText(
      source.message ?? source.error_message ?? source.meta_error_message,
    ),
  };
}
export class InstagramError extends Error {
  constructor(
    public code: InstagramErrorCode,
    public retryable = false,
    public metaCode?: number,
    public metaSubcode?: number,
    public diagnostic?: MetaDiagnostic,
  ) {
    super(`Instagram: ${code}`);
  }
  toJSON() {
    return {
      code: this.code,
      retryable: this.retryable,
      metaCode: this.metaCode,
      metaSubcode: this.metaSubcode,
    };
  }
}
export function normalizeMeta(
  status: number,
  body: unknown,
  secrets: readonly string[] = [],
): InstagramError {
  const diagnostic = sanitizeMetaDiagnostic(status, body, secrets);
  const e = (
    body as {
      error?: { code?: number; error_subcode?: number; is_transient?: boolean };
    }
  )?.error;
  const code = diagnostic.meta_error_code,
    sub = diagnostic.meta_error_subcode;
  const kind: InstagramErrorCode =
    code === 190
      ? "expired_token"
      : [10, 200, 294].includes(code ?? 0)
        ? "missing_permission"
        : status === 429 || [4, 17, 32, 613].includes(code ?? 0)
          ? "rate_limit"
          : [2207009, 2207027].includes(sub ?? 0)
            ? "media_url_inaccessible"
            : [36000, 36001].includes(code ?? 0)
              ? "invalid_media"
              : "meta_api_error";
  return new InstagramError(
    kind,
    kind === "rate_limit" || status >= 500 || e?.is_transient === true,
    code,
    sub,
    diagnostic,
  );
}
export function publicationError(error: unknown): InstagramError {
  return error instanceof InstagramError
    ? error
    : new InstagramError("meta_api_error");
}
