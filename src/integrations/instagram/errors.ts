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
export class InstagramError extends Error {
  constructor(
    public code: InstagramErrorCode,
    public retryable = false,
    public metaCode?: number,
    public metaSubcode?: number,
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
export function normalizeMeta(status: number, body: unknown): InstagramError {
  const e = (
    body as {
      error?: { code?: number; error_subcode?: number; is_transient?: boolean };
    }
  )?.error;
  const code = e?.code,
    sub = e?.error_subcode;
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
  );
}
export function publicationError(error: unknown): InstagramError {
  return error instanceof InstagramError
    ? error
    : new InstagramError("meta_api_error");
}
