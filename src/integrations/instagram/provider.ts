import { ensure } from "../../common/core.js";
import { InstagramError } from "./errors.js";
import { MetaHTTP, instagramObject } from "./http.js";
import { requireVersion, type InstagramConfig } from "./config.js";
import type { InstagramConnection } from "./vault.js";

export type InstagramSurface = "feed" | "reel" | "carousel" | "story";
export interface InstagramMediaInput {
  surface: InstagramSurface;
  mediaURL?: string;
  caption: string;
  children?: string[];
  isCarouselItem?: boolean;
}
export interface ContainerState {
  id: string;
  status: "IN_PROGRESS" | "FINISHED" | "PUBLISHED" | "ERROR" | "EXPIRED";
}
export interface InstagramPublishingContract {
  readonly name: "instagram";
  checkConnection(): Promise<{
    accountId: string;
    username: string;
    accountType: string;
    permissions: string[];
  }>;
  createContainer(input: InstagramMediaInput): Promise<string>;
  getContainer(id: string): Promise<ContainerState>;
  waitForContainer(id: string): Promise<ContainerState>;
  publishContainer(id: string): Promise<string>;
  permalink(id: string): Promise<string | null>;
  inspectPublished(
    id: string,
    caption: string,
    since: string,
  ): Promise<{ id: string; permalink: string | null }>;
}
const numeric = (id: string) => {
  ensure(/^\d+$/.test(id), "Invalid Instagram object ID");
  return id;
};
export class InstagramPublishingProvider implements InstagramPublishingContract {
  readonly name = "instagram" as const;
  private base: string;
  constructor(
    private config: InstagramConfig,
    private connection: InstagramConnection,
    private meta = new MetaHTTP(),
    private polling = { attempts: 5, intervalMs: 60_000 },
    private pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  ) {
    this.base = `https://graph.instagram.com/${requireVersion(config)}`;
    numeric(connection.accountId);
    ensure(
      polling.attempts > 0 &&
        polling.attempts <= 60 &&
        polling.intervalMs >= 0 &&
        polling.intervalMs <= 60_000,
      "Invalid processing poll limits",
    );
  }
  private request(
    path: string,
    method: "GET" | "POST" | "DELETE",
    params: Record<string, string> = {},
  ) {
    if (
      this.connection.expiresAt &&
      (!Number.isFinite(Date.parse(this.connection.expiresAt)) ||
        Date.parse(this.connection.expiresAt) <= Date.now())
    )
      throw new InstagramError("expired_token");
    return this.meta.request(
      `${this.base}/${path}`,
      method,
      params,
      this.connection.accessToken,
    );
  }
  async checkConnection() {
    const me = instagramObject(
      await this.request("me", "GET", {
        fields: "user_id,username,account_type",
      }),
    );
    if (String(me.user_id) !== this.connection.accountId)
      throw new InstagramError("missing_permission");
    const granted = await this.request(
      `${numeric(this.connection.accountId)}/permissions`,
      "GET",
    );
    const permissions = (Array.isArray(granted.data) ? granted.data : [])
      .filter((p: { status?: string }) => p.status === "granted")
      .map((p: { permission?: string }) => String(p.permission));
    if (
      !["instagram_business_basic", "instagram_business_content_publish"].every(
        (p) => permissions.includes(p),
      )
    )
      throw new InstagramError("missing_permission");
    const accountType = String(
      me.account_type ?? this.connection.accountType,
    ).toUpperCase();
    if (!["BUSINESS", "MEDIA_CREATOR", "CREATOR"].includes(accountType))
      throw new InstagramError("missing_permission");
    return {
      accountId: this.connection.accountId,
      username: String(me.username ?? ""),
      accountType,
      permissions,
    };
  }
  async createContainer(input: InstagramMediaInput): Promise<string> {
    if (!this.config.enabled) throw new InstagramError("publishing_disabled");
    if (
      [...input.caption].length > 2200 ||
      (input.caption.match(/#[^\s#]+/g) ?? []).length > 30
    )
      throw new InstagramError("invalid_media");
    const params: Record<string, string> = {};
    if (input.surface === "carousel") {
      if (
        !input.children ||
        input.children.length < 2 ||
        input.children.length > 10
      )
        throw new InstagramError("invalid_media");
      params.media_type = "CAROUSEL";
      params.children = input.children.map(numeric).join(",");
    } else {
      let url: URL;
      try {
        url = new URL(input.mediaURL!);
      } catch {
        throw new InstagramError("invalid_media");
      }
      if (url.protocol !== "https:" || url.username || url.password)
        throw new InstagramError("invalid_media");
      params[input.surface === "reel" ? "video_url" : "image_url"] = url.href;
      if (input.surface === "reel") {
        params.media_type = "REELS";
        params.share_to_feed = "true";
      }
      if (input.surface === "story") params.media_type = "STORIES";
    }
    if (input.surface !== "story" && !input.isCarouselItem)
      params.caption = input.caption;
    if (input.isCarouselItem) params.is_carousel_item = "true";
    const data = await this.request(
      `${this.connection.accountId}/media`,
      "POST",
      params,
    );
    if (!data.id) throw new InstagramError("meta_api_error");
    return numeric(String(data.id));
  }
  async getContainer(id: string): Promise<ContainerState> {
    const data = await this.request(numeric(id), "GET", {
      fields: "id,status_code",
    });
    if (
      !["IN_PROGRESS", "FINISHED", "PUBLISHED", "ERROR", "EXPIRED"].includes(
        String(data.status_code),
      )
    )
      throw new InstagramError("container_failed");
    return { id, status: data.status_code as ContainerState["status"] };
  }
  async waitForContainer(id: string): Promise<ContainerState> {
    for (let n = 0; n < this.polling.attempts; n++) {
      const state = await this.getContainer(id);
      if (state.status === "ERROR" || state.status === "EXPIRED")
        throw new InstagramError("container_failed");
      if (state.status === "FINISHED" || state.status === "PUBLISHED")
        return state;
      if (n + 1 < this.polling.attempts)
        await this.pause(this.polling.intervalMs);
    }
    throw new InstagramError("processing_timeout", true);
  }
  async publishContainer(id: string): Promise<string> {
    if (!this.config.enabled) throw new InstagramError("publishing_disabled");
    const data = await this.request(
      `${this.connection.accountId}/media_publish`,
      "POST",
      { creation_id: numeric(id) },
    );
    if (!data.id) throw new InstagramError("reconciliation_required");
    return numeric(String(data.id));
  }
  async permalink(id: string): Promise<string | null> {
    const data = await this.request(numeric(id), "GET", {
      fields: "id,permalink",
    });
    if (typeof data.permalink !== "string") return null;
    const link = new URL(data.permalink);
    return link.protocol === "https:" &&
      ["www.instagram.com", "instagram.com"].includes(link.hostname)
      ? link.href
      : null;
  }
  async inspectPublished(
    id: string,
    caption: string,
    since: string,
  ): Promise<{ id: string; permalink: string | null }> {
    numeric(id);
    const data = await this.request(
      `${this.connection.accountId}/media`,
      "GET",
      { fields: "id,caption,timestamp", limit: "100" },
    );
    const media = (Array.isArray(data.data) ? data.data : []).find(
      (m: { id?: string }) => String(m.id) === id,
    ) as { id: string; caption?: string; timestamp?: string } | undefined;
    if (
      !media ||
      media.caption !== caption ||
      !media.timestamp ||
      !Number.isFinite(Date.parse(media.timestamp)) ||
      Date.parse(media.timestamp) < Date.parse(since) - 300_000
    )
      throw new InstagramError("reconciliation_required");
    let permalink: string | null = null;
    try {
      permalink = await this.permalink(id);
    } catch {
      /* Receipt can be reconciled without optional permalink. */
    }
    return { id, permalink };
  }
}

