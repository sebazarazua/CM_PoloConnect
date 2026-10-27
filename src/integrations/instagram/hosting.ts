import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp, { type Metadata } from "sharp";
import { ensure } from "../../common/core.js";
import type { Asset } from "../../domain/models.js";
import { fileDigest } from "../../render/brand.js";
import { localPath } from "../../render/spec.js";
import { InstagramError } from "./errors.js";
import { officialTransport, type HttpTransport } from "./http.js";

export const bytesHash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
export interface PreparedMedia {
  path: string;
  sha256: string;
  sourceSha256: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
  byteLength: number;
}
export interface HostedMedia {
  provider: "s3" | "local-mock";
  key: string;
  sha256: string;
  expiresAt: string;
  cleanupAfter: string;
}
export interface MediaHostingProvider {
  close?(): void;
  readonly name: "s3" | "local-mock";
  upload(
    media: PreparedMedia,
    packageHash: string,
  ): Promise<{ reference: HostedMedia; url: string }>;
  assertAccessible(url: string, media: PreparedMedia): Promise<void>;
  delete(reference: HostedMedia): Promise<void>;
}
export async function prepareImage(
  asset: Asset,
  output = ".local/instagram-media",
): Promise<PreparedMedia> {
  if (
    asset.type !== "graphic" ||
    asset.stage !== "rendered" ||
    asset.metadata.actualMedia !== true
  )
    throw new InstagramError("invalid_media");
  const source = localPath(asset.storageRef),
    sourceBytes = await readFile(source);
  const sourceSha256 = bytesHash(sourceBytes);
  if (sourceSha256 !== asset.metadata.sha256)
    throw new InstagramError("stale_approval");
  let bytes: Buffer, metadata: Metadata;
  try {
    metadata = await sharp(sourceBytes).metadata();
    if (
      !["png", "jpeg"].includes(metadata.format ?? "") ||
      (metadata.pages ?? 1) !== 1 ||
      (metadata.orientation && metadata.orientation !== 1)
    )
      throw new Error();
    if (
      metadata.width !== asset.metadata.width ||
      metadata.height !== asset.metadata.height
    )
      throw new Error();
    const width = metadata.width!,
      height = metadata.height!,
      ratio = width / height;
    // Conservative feed subset; no cropping or resizing after human approval.
    if (width < 320 || width > 1440 || ratio < 0.8 || ratio > 1.91)
      throw new Error();
    bytes =
      metadata.format === "jpeg"
        ? sourceBytes
        : await sharp(sourceBytes)
            .flatten({ background: "#ffffff" })
            .toColourspace("srgb")
            .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
            .toBuffer();
    if (bytes.length > 8 * 1024 * 1024) throw new Error();
  } catch {
    throw new InstagramError("invalid_media");
  }
  const sha256 = bytesHash(bytes),
    path = resolve(output, `${sha256}.jpg`);
  await mkdir(resolve(output), { recursive: true });
  await writeFile(path, bytes, { flag: "w" });
  return {
    path,
    sha256,
    sourceSha256,
    mimeType: "image/jpeg",
    width: metadata.width!,
    height: metadata.height!,
    byteLength: bytes.length,
  };
}
export class LocalMockMediaHostingProvider implements MediaHostingProvider {
  readonly name = "local-mock" as const;
  deleted: string[] = [];
  async upload(media: PreparedMedia, packageHash: string) {
    ensure(fileDigest(media.path) === media.sha256, "Prepared media changed");
    const reference: HostedMedia = {
      provider: this.name,
      key: `fixtures/${packageHash}/${media.sha256}.jpg`,
      sha256: media.sha256,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      cleanupAfter: new Date(Date.now() + 604_800_000).toISOString(),
    };
    return { reference, url: `https://media.example.invalid/${reference.key}` };
  }
  async assertAccessible(_url: string, _media: PreparedMedia) {}
  async delete(reference: HostedMedia) {
    this.deleted.push(reference.key);
  }
}
export interface S3Settings {
  bucket: string;
  region: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  prefix: string;
  urlTTLSeconds: number;
  retentionDays: number;
}
export function s3Settings(env: NodeJS.ProcessEnv = process.env): S3Settings {
  const urlTTLSeconds = Number(env.S3_MEDIA_URL_TTL_SECONDS || 86400),
    retentionDays = Number(env.S3_MEDIA_RETENTION_DAYS || 7);
  ensure(
    Number.isInteger(urlTTLSeconds) &&
      urlTTLSeconds >= 3600 &&
      urlTTLSeconds <= 604800,
    "S3 URL validity must be 1 hour to 7 days",
  );
  ensure(
    Number.isInteger(retentionDays) &&
      retentionDays >= Math.ceil(urlTTLSeconds / 86400) + 1 &&
      retentionDays <= 90,
    "S3 retention must exceed URL lifetime by at least one day (maximum 90 days)",
  );
  const prefix = env.S3_MEDIA_PREFIX || "polo-connect/instagram/";
  ensure(
    /^[a-zA-Z0-9/_-]+\/$/.test(prefix) && !prefix.includes(".."),
    "Invalid S3 media prefix",
  );
  return {
    bucket: env.S3_BUCKET || "",
    region: env.S3_REGION || env.AWS_REGION || "",
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
    forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
    prefix,
    urlTTLSeconds,
    retentionDays,
  };
}
export class S3MediaHostingProvider implements MediaHostingProvider {
  readonly name = "s3" as const;
  private client: S3Client;
  close() {
    this.client.destroy();
  }
  constructor(
    private settings: S3Settings,
    client?: S3Client,
    private transport: HttpTransport = officialTransport,
  ) {
    ensure(
      settings.bucket && settings.region,
      "Set S3_BUCKET and S3_REGION for real publishing",
    );
    if (settings.endpoint)
      ensure(
        new URL(settings.endpoint).protocol === "https:",
        "Real S3 endpoint must use HTTPS",
      );
    this.client =
      client ??
      new S3Client({
        region: settings.region,
        endpoint: settings.endpoint,
        forcePathStyle: settings.forcePathStyle,
        maxAttempts: 3,
        requestHandler: { requestTimeout: 30_000, connectionTimeout: 10_000 },
      });
  }
  async upload(media: PreparedMedia, packageHash: string) {
    const bytes = await readFile(media.path);
    ensure(
      bytesHash(bytes) === media.sha256,
      "Prepared media changed before upload",
    );
    ensure(
      /^[a-f0-9]{64}$/.test(packageHash),
      "Invalid publication package hash",
    );
    const key = `${this.settings.prefix}${packageHash}/${media.sha256}.jpg`;
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.settings.bucket,
          Key: key,
          Body: bytes,
          ContentType: media.mimeType,
          CacheControl: "private, max-age=86400",
          Metadata: { sha256: media.sha256 },
          IfNoneMatch: "*",
        }),
      );
    } catch (error) {
      if (
        (error as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 412
      ) {
        const existing = await this.client.send(
          new HeadObjectCommand({ Bucket: this.settings.bucket, Key: key }),
        );
        ensure(
          existing.Metadata?.sha256 === media.sha256,
          "S3 immutable object hash mismatch",
        );
      } else throw new InstagramError("network_failure", true);
    }
    const credentials = await this.client.config.credentials();
    const seconds = credentials.expiration
      ? Math.min(
          this.settings.urlTTLSeconds,
          Math.floor((credentials.expiration.getTime() - Date.now()) / 1000) -
            60,
        )
      : this.settings.urlTTLSeconds;
    ensure(
      seconds >= 3600,
      "S3 session credentials expire too soon; renew before publishing",
    );
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.settings.bucket, Key: key }),
      { expiresIn: seconds },
    );
    const reference: HostedMedia = {
      provider: this.name,
      key,
      sha256: media.sha256,
      expiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
      cleanupAfter: new Date(
        Date.now() + this.settings.retentionDays * 86400000,
      ).toISOString(),
    };
    return { reference, url };
  }
  async assertAccessible(url: string, media: PreparedMedia): Promise<void> {
    // A GET signature cannot be checked with HEAD. Read the bounded image and verify its bytes.
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" || parsed.username || parsed.password)
        throw new Error();
      const response = await this.transport(url, {
        method: "GET",
        signal: AbortSignal.timeout(30_000),
        redirect: "error",
      });
      if (
        !response.ok ||
        !/image\/jpeg/i.test(response.headers.get("content-type") ?? "")
      )
        throw new Error();
      const reader = response.body?.getReader();
      if (!reader) throw new Error();
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.length;
          if (size > 8 * 1024 * 1024) throw new Error();
          chunks.push(chunk.value);
        }
      } finally {
        await reader.cancel();
      }
      if (bytesHash(Buffer.concat(chunks)) !== media.sha256) throw new Error();
    } catch {
      throw new InstagramError("media_url_inaccessible", true);
    }
  }
  async delete(reference: HostedMedia): Promise<void> {
    ensure(
      reference.provider === "s3" &&
        reference.key.startsWith(this.settings.prefix) &&
        Date.parse(reference.cleanupAfter) <= Date.now(),
      "S3 retention has not elapsed or reference is outside managed prefix",
    );
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.settings.bucket,
          Key: reference.key,
        }),
      );
    } catch {
      throw new InstagramError("network_failure", true);
    }
  }
}
