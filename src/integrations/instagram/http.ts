import { InstagramError, normalizeMeta } from "./errors.js";

export type HttpTransport = (
  url: string,
  init: RequestInit,
) => Promise<Response>;
/** Instagram can wrap token and profile objects in a data array. */
export function instagramObject(
  response: Record<string, unknown>,
): Record<string, unknown> {
  const object = (
    Array.isArray(response.data) ? response.data[0] : response
  ) as Record<string, unknown>;
  if (!object || typeof object !== "object" || Array.isArray(object))
    throw new InstagramError("meta_api_error");
  return object;
}
/** The sole fetch boundary for Meta and presigned media checks. No logging of URLs/bodies/headers. */
export const officialTransport: HttpTransport = async (url, init) => {
  if (process.env.VITEST) throw new InstagramError("publishing_disabled");
  return fetch(url, {
    ...init,
    redirect: "error",
    signal: init.signal ?? AbortSignal.timeout(30_000),
  });
};
export class MetaHTTP {
  constructor(private transport: HttpTransport = officialTransport) {}
  async request(
    url: string,
    method: "GET" | "POST" | "DELETE",
    params: Record<string, string> = {},
    credential?: string,
  ): Promise<Record<string, unknown>> {
    const target = new URL(url);
    if (
      target.protocol !== "https:" ||
      !["graph.instagram.com", "api.instagram.com"].includes(target.hostname)
    )
      throw new InstagramError("meta_api_error");
    const values = new URLSearchParams(params);
    if (method === "GET") target.search = values.toString();
    let response: Response;
    try {
      response = await this.transport(target.href, {
        method,
        headers: {
          ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
          ...(method === "POST"
            ? { "Content-Type": "application/x-www-form-urlencoded" }
            : {}),
        },
        ...(method === "POST" ? { body: values.toString() } : {}),
      });
    } catch (error) {
      if (error instanceof InstagramError) throw error;
      throw new InstagramError("network_failure", true);
    }
    let data: Record<string, unknown>;
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      throw new InstagramError("meta_api_error", response.status >= 500);
    }
    if (!response.ok || data.error || data.error_type)
      throw normalizeMeta(response.status, data);
    return data;
  }
}
