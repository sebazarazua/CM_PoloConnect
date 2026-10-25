import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensure, hash, now } from "../../common/core.js";
import type {
  Asset,
  ContentItem,
  PerformanceSnapshot,
  Publication,
  PublishPackage,
  SkillOutputs,
} from "../../domain/models.js";
import type {
  AnalyticsProvider,
  AssetRepository,
  DesignRenderer,
  DiscoveredEvent,
  PoloConnectDataProvider,
  PoloSourceProvider,
  Providers,
  PublishingProvider,
  PublishReceipt,
  VideoProvider,
} from "../contracts.js";

export class MockPublishingProvider implements PublishingProvider {
  readonly name = "mock";
  readonly ledger = new Map<
    string,
    { receipt: PublishReceipt; payload: PublishPackage }
  >();
  async validate(
    payload: PublishPackage,
  ): Promise<{ valid: boolean; issues: string[] }> {
    const issues: string[] = [];
    if (payload.simulated !== true)
      issues.push("Only simulated packages accepted");
    if (
      payload.assets.some(
        (a) =>
          !["owned", "licensed", "permission_confirmed"].includes(a.rights),
      )
    )
      issues.push("blocked_rights");
    if (!payload.copy.outputs.caption && !payload.copy.outputs.headline)
      issues.push("missing copy");
    return { valid: !issues.length, issues };
  }
  private async send(
    payload: PublishPackage,
    key: string,
    status: "published" | "scheduled",
    at: string,
  ): Promise<PublishReceipt> {
    const check = await this.validate(payload);
    ensure(check.valid, check.issues.join(";"));
    const externalId = `mock_${hash(key).slice(0, 24)}`;
    const old = this.ledger.get(externalId);
    if (old) return old.receipt;
    const receipt: PublishReceipt = { externalId, status, at, simulated: true };
    this.ledger.set(externalId, { receipt, payload: structuredClone(payload) });
    return receipt;
  }
  schedule(
    payload: PublishPackage,
    at: string,
    key: string,
  ): Promise<PublishReceipt> {
    ensure(Date.parse(at) > Date.now(), "Schedule must be in the future");
    return this.send(payload, key, "scheduled", at);
  }
  publish(payload: PublishPackage, key: string): Promise<PublishReceipt> {
    return this.send(payload, key, "published", now());
  }
  async getStatus(externalId: string): Promise<PublishReceipt | null> {
    return this.ledger.get(externalId)?.receipt ?? null;
  }
  async deleteScheduled(externalId: string): Promise<void> {
    const row = this.ledger.get(externalId);
    if (row) {
      ensure(
        row.receipt.status === "scheduled",
        "Only scheduled mock entries may be cancelled",
      );
      row.receipt.status = "cancelled";
    }
  }
}
export class MockAnalyticsProvider implements AnalyticsProvider {
  readonly name = "mock";
  async snapshot(p: Publication, window: string): Promise<PerformanceSnapshot> {
    ensure(p.status === "published", "Analytics requires publication");
    const observedAt = new Date(
      Date.parse(p.publishedAt!) + 72 * 3600000,
    ).toISOString();
    return {
      id: `snapshot-${p.id}-${window}`,
      contentId: p.payload.contentId,
      publicationId: p.id,
      observedAt,
      window,
      simulated: true,
      metrics: [
        {
          metric_id: "demo-reach",
          name: "organic_reach",
          value: 1200,
          source: "MockAnalyticsProvider",
          observed_at: observedAt,
          window,
          denominator: null,
          organic_paid_scope: "organic",
          definition_version: "demo-v1",
          availability_status: "available",
        },
        {
          metric_id: "demo-saves",
          name: "saves",
          value: 24,
          source: "MockAnalyticsProvider",
          observed_at: observedAt,
          window,
          denominator: null,
          organic_paid_scope: "organic",
          definition_version: "demo-v1",
          availability_status: "available",
        },
      ],
      definitions: {
        organic_reach:
          "Cuentas únicas ficticias; sin deducción de métricas no disponibles",
        saves: "Guardados ficticios; demo-v1",
      },
    };
  }
}
function renderAsset(
  key: string,
  type: Asset["type"],
  sources: Asset[],
): Asset {
  return {
    id: `render-${key}`,
    type,
    stage: "rendered",
    storageRef: `mock://renders/${key}`,
    rights: "owned",
    required: true,
    source: "MockRenderer",
    credit: null,
    metadata: {
      simulated: true,
      actualMedia: false,
      sourceIds: sources.map((a) => a.id),
    },
  };
}
export class MockDesignRenderer implements DesignRenderer {
  async render(
    plan: SkillOutputs["social-designer"],
    sources: Asset[],
  ): Promise<Asset[]> {
    return [renderAsset(hash(plan).slice(0, 20), "graphic", sources)];
  }
}
export class MockVideoProvider implements VideoProvider {
  private jobs = new Map<string, Asset[]>();
  async discoverClips(eventId: string): Promise<Asset[]> {
    return [demoAsset(eventId, "reel")];
  }
  async getMetadata(assetId: string): Promise<Record<string, unknown>> {
    return { id: assetId, simulated: true, timeBase: "00:00:00.000" };
  }
  async requestCut(
    plan: SkillOutputs["reel-planner"],
    sources: Asset[],
  ): Promise<{ jobId: string }> {
    const jobId = hash(plan).slice(0, 20);
    this.jobs.set(jobId, [renderAsset(jobId, "video", sources)]);
    return { jobId };
  }
  async getRender(jobId: string): Promise<Asset[]> {
    return this.jobs.get(jobId) ?? [];
  }
}
export function demoAsset(eventId: string, type: ContentItem["type"]): Asset {
  return {
    id: `asset-${eventId}-${type === "reel" ? "clip" : "photo"}`,
    type: type === "reel" ? "video" : "photo",
    stage: "raw",
    storageRef: `mock://raw/${eventId}`,
    rights: "owned",
    required: true,
    source: "Fixture ficticio",
    credit: "Polo Connect Demo",
    metadata: { simulated: true, actualMedia: false, eventId },
  };
}
export class ReferenceAssetRepository implements AssetRepository {
  private assets = new Map<string, Asset>();
  async findForEvent(
    eventId: string,
    type: ContentItem["type"],
  ): Promise<Asset[]> {
    const a = demoAsset(eventId, type);
    this.assets.set(a.id, a);
    return [structuredClone(a)];
  }
  async get(id: string): Promise<Asset | null> {
    return structuredClone(this.assets.get(id) ?? null);
  }
  async save(asset: Asset): Promise<void> {
    this.assets.set(asset.id, structuredClone(asset));
  }
}
export class MockPoloDataProvider implements PoloConnectDataProvider {
  async getMatches() {
    return [
      {
        id: "demo-match-1",
        tournament: "Torneo Demo",
        teams: ["Team Azul", "Team Blanco"],
        simulated: true,
      },
    ];
  }
  async getCalendar() {
    return [
      {
        id: "demo-match-1",
        at: "2026-10-24T20:00:00-03:00",
        timezone: "America/Buenos_Aires",
        simulated: true,
      },
    ];
  }
  async getTournaments() {
    return [{ id: "demo-tournament", name: "Torneo Demo", simulated: true }];
  }
  async getResults() {
    return [{ matchId: "demo-match-1", score: "12-10", simulated: true }];
  }
  async getStatistics() {
    return [];
  }
  async getPlayers() {
    return [];
  }
  async getTeams() {
    return [{ name: "Team Azul" }, { name: "Team Blanco" }];
  }
  async getHorses() {
    return [];
  }
  async getStreams() {
    return [];
  }
  async getReplays() {
    return [];
  }
}
export function demoEvent(): DiscoveredEvent {
  const candidate = JSON.parse(
    readFileSync(
      resolve("fixtures/skill-outputs/polo-news-researcher.json"),
      "utf8",
    ),
  ) as SkillOutputs["polo-news-researcher"];
  candidate.event_id = "demo-match-1";
  candidate.headline_working = "Team Azul 12-10 Team Blanco";
  candidate.claims = [
    {
      claim: "Team Azul venció a Team Blanco por 12-10",
      status: "confirmed_primary",
      confidence: "high",
      source_ids: ["demo-official"],
    },
  ];
  candidate.entities = [
    { type: "team", canonical_name: "Team Azul" },
    { type: "team", canonical_name: "Team Blanco" },
    { type: "tournament", canonical_name: "Torneo Demo" },
  ];
  candidate.time = { event_started_at: "2026-10-24T18:00:00-03:00" };
  candidate.sources = [
    {
      source_id: "demo-official",
      url: "https://official.example.invalid/demo-match-1",
      role: "primary_official",
      publisher: "Organizador ficticio",
      observed_at: candidate.observed_at,
      original_reporting: true,
    },
  ];
  candidate.simulated = true;
  return { logicalKey: "demo:tournament-1:match-1:2026-10-24", candidate };
}
export class MockPoloSourceProvider implements PoloSourceProvider {
  readonly name = "fixtures";
  async discover(): Promise<DiscoveredEvent[]> {
    return [demoEvent()];
  }
}
export function mockProviders(): Providers {
  return {
    publishing: new MockPublishingProvider(),
    analytics: new MockAnalyticsProvider(),
    design: new MockDesignRenderer(),
    video: new MockVideoProvider(),
    assets: new ReferenceAssetRepository(),
    data: new MockPoloDataProvider(),
    sources: new MockPoloSourceProvider(),
  };
}
