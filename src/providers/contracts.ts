import type {
  Asset,
  ContentItem,
  PerformanceSnapshot,
  Publication,
  PublishPackage,
  SkillOutputs,
} from "../domain/models.js";

export interface PublishReceipt {
  externalId: string;
  status: "scheduled" | "published" | "cancelled";
  at: string;
  simulated: true;
}
export interface PublishingProvider {
  readonly name: string;
  validate(
    payload: PublishPackage,
  ): Promise<{ valid: boolean; issues: string[] }>;
  schedule(
    payload: PublishPackage,
    at: string,
    key: string,
  ): Promise<PublishReceipt>;
  publish(payload: PublishPackage, key: string): Promise<PublishReceipt>;
  getStatus(externalId: string): Promise<PublishReceipt | null>;
  deleteScheduled(externalId: string): Promise<void>;
}
export interface AnalyticsProvider {
  readonly name: string;
  snapshot(
    publication: Publication,
    window: string,
  ): Promise<PerformanceSnapshot>;
}
export interface DesignRenderer {
  render(
    plan: SkillOutputs["social-designer"],
    sources: Asset[],
    context?: {
      event: SkillOutputs["polo-news-researcher"];
      eventVersion?: number;
      recentFamilies?: string[];
    },
  ): Promise<Asset[]>;
}
export interface VideoProvider {
  discoverClips(eventId: string): Promise<Asset[]>;
  getMetadata(assetId: string): Promise<Record<string, unknown>>;
  requestCut(
    plan: SkillOutputs["reel-planner"],
    sources: Asset[],
  ): Promise<{ jobId: string }>;
  getRender(jobId: string): Promise<Asset[]>;
}
export interface AssetRepository {
  findForEvent(eventId: string, type: ContentItem["type"]): Promise<Asset[]>;
  get(id: string): Promise<Asset | null>;
  save(asset: Asset): Promise<void>;
}
export interface PoloConnectDataProvider {
  getMatches(): Promise<Record<string, unknown>[]>;
  getCalendar(): Promise<Record<string, unknown>[]>;
  getTournaments(): Promise<Record<string, unknown>[]>;
  getResults(): Promise<Record<string, unknown>[]>;
  getStatistics(): Promise<Record<string, unknown>[]>;
  getPlayers(): Promise<Record<string, unknown>[]>;
  getTeams(): Promise<Record<string, unknown>[]>;
  getHorses(): Promise<Record<string, unknown>[]>;
  getStreams(): Promise<Record<string, unknown>[]>;
  getReplays(): Promise<Record<string, unknown>[]>;
}
export interface DiscoveredEvent {
  logicalKey: string;
  candidate: SkillOutputs["polo-news-researcher"];
}
export interface PoloSourceProvider {
  readonly name: string;
  discover(): Promise<DiscoveredEvent[]>;
}
export interface Providers {
  publishing: PublishingProvider;
  analytics: AnalyticsProvider;
  design: DesignRenderer;
  video: VideoProvider;
  assets: AssetRepository;
  data: PoloConnectDataProvider;
  sources: PoloSourceProvider;
}
