import { it, expect, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { runAutoCycle } from "../src/automation/cycle.js";
import { loadAutomationConfig } from "../src/automation/config.js";
import {
  AutomaticPublishingPolicy,
  inEditorialWindow,
  sourceEligibility,
} from "../src/automation/policy.js";
import {
  AutomaticPublicationAuthority,
  grantPolicyApproval,
} from "../src/automation/authority.js";
import {
  FixtureContentSource,
  ManualQueueContentSource,
  candidateKey,
  validateCandidate,
} from "../src/automation/sources.js";
import {
  FileRepository,
  MemoryRepository,
} from "../src/persistence/repository.js";
import { current, type Store, type ContentItem } from "../src/domain/models.js";
import { validApproval } from "../src/approvals/service.js";
import { LocalMockMediaHostingProvider } from "../src/integrations/instagram/hosting.js";
import { InstagramPublicationService } from "../src/integrations/instagram/service.js";
import {
  FakeGeminiExecutor,
  fakeInstagram,
  geminiSettings,
  autoConfig,
} from "./automation-helpers.js";
import type {
  ContentCandidate,
  AutomationCycle,
} from "../src/automation/types.js";

const directory = mkdtempSync(resolve(".local/automation-test-"));
let candidate: ContentCandidate,
  base: Store,
  contentId: string,
  supervised: AutomationCycle;
const executor = new FakeGeminiExecutor();
const source = {
  name: "test-manual-queue",
  discover: async () => [structuredClone(candidate)],
};
const liveConfig = () => ({
  ...autoConfig(),
  mode: "automatic" as const,
  enableAutoPublish: true,
  enableRealPublishing: true,
  dryRun: false,
});
beforeAll(async () => {
  vi.stubEnv("AI_USAGE_JOURNAL_FILE", join(directory, "usage.jsonl"));
  candidate = (await new FixtureContentSource().discover())[0]!;
  candidate.consent.allowAutomatic = true;
  const repository = new MemoryRepository();
  supervised = await runAutoCycle({
    repository,
    source,
    config: autoConfig,
    executor,
    settings: geminiSettings(),
    fixtureHTTP: true,
    outputDirectory: join(directory, "renders"),
  });
  base = await repository.read();
  contentId = Object.keys(base.contents)[0]!;
}, 120_000);
afterAll(() => {
  vi.unstubAllEnvs();
  expect(directory.startsWith(resolve(".local"))).toBe(true);
  rmSync(directory, { recursive: true, force: true });
});
async function repository(state = base) {
  const repo = new MemoryRepository();
  await repo.transaction(async (s) => {
    Object.assign(s, structuredClone(state));
  });
  return repo;
}
function decision(
  state = structuredClone(base),
  c = candidate,
  cfg = liveConfig(),
) {
  return new AutomaticPublishingPolicy().evaluate(
    state,
    state.contents[contentId]!,
    c,
    cfg,
  );
}

it("A supervised: renders real pixels, invokes the Gemini transport contract for 4 Skills, keeps approval pending and never publishes", () => {
  expect(supervised.counters.failed, JSON.stringify(supervised)).toBe(0);
  expect(supervised.counters.generated).toBe(1);
  expect(
    supervised.counters.approval_required,
    JSON.stringify(supervised),
  ).toBe(1);
  expect(supervised.entries[0]?.would_publish).toBe(false);
  expect(supervised.simulated).toBe(true);
  expect(executor.calls).toEqual([
    "content-opportunity-detector",
    "social-designer",
    "copywriter",
    "quality-reviewer",
  ]);
  const item = base.contents[contentId]!;
  expect(item.status).toBe("ready_for_human_approval");
  expect(item.approvals.at(-1)?.state).toBe("pending_approval");
  expect(item.publications).toHaveLength(0);
  const qa = executor.requests.at(-1)!;
  expect(JSON.stringify(qa.contents)).toContain("inlineData");
  expect(
    readFileSync(supervised.entries[0]!.asset!).byteLength,
  ).toBeGreaterThan(10000);
  expect(supervised.entries[0]!.caption).toMatch(/^PRUEBA TÉCNICA/);
  expect(base.automation?.lease).toBeUndefined();
});
it("B dry run then C simulated HTTP: cache, persistent receipt, policy authority and restart idempotence", async () => {
  const path = join(directory, "restart.json");
  let repo = new FileRepository(path);
  await repo.transaction(async (s) => {
    Object.assign(s, structuredClone(base));
  });
  const meta = fakeInstagram(),
    hosting = new LocalMockMediaHostingProvider();
  const b = { ...liveConfig(), dryRun: true };
  const options = {
    source,
    executor,
    settings: geminiSettings(),
    provider: meta.provider,
    hosting,
    fixtureHTTP: true,
    outputDirectory: join(directory, "renders"),
  };
  const before = executor.calls.length;
  const dry = await runAutoCycle({
    ...options,
    repository: repo,
    config: () => b,
  });
  expect(dry.counters.failed, JSON.stringify(dry)).toBe(0);
  expect(dry.entries[0]?.would_publish, JSON.stringify(dry)).toBe(true);
  expect(meta.calls.filter((p) => p.endsWith("/media_publish"))).toHaveLength(
    0,
  );
  expect((await repo.read()).contents[contentId]!.publications).toHaveLength(0);
  expect(executor.calls.length).toBe(before);
  expect(dry.counters.duplicate).toBe(1);
  await repo.close();
  repo = new FileRepository(path);
  const dryAgain = await runAutoCycle({
    ...options,
    repository: repo,
    config: () => b,
  });
  expect(dryAgain.entries[0]?.would_publish, JSON.stringify(dryAgain)).toBe(
    true,
  );
  expect(meta.calls.filter((p) => p.endsWith("/media"))).toHaveLength(1);
  const live = await runAutoCycle({
    ...options,
    repository: repo,
    config: liveConfig,
  });
  expect(live.counters.failed, JSON.stringify(live)).toBe(0);
  expect(live.counters.published, JSON.stringify(live)).toBe(1);
  const published = (await repo.read()).contents[contentId]!;
  expect(published.publications[0]?.instagram?.igMediaId).toBe("900");
  expect(
    published.publications[0]?.instagram?.publicationPackage.approvalAuthority,
  ).toBe("policy");
  expect(validApproval(published)).toBeUndefined();
  expect(
    (await repo.read()).automation?.policyApprovals[contentId],
  ).toHaveLength(1);
  await repo.close();
  repo = new FileRepository(path);
  const repeat = await runAutoCycle({
    ...options,
    repository: repo,
    config: liveConfig,
  });
  expect(repeat.counters.generated).toBe(0);
  expect(repeat.counters.published).toBe(0);
  expect(repeat.counters.duplicate).toBe(1);
  expect(meta.calls.filter((p) => p.endsWith("/media_publish"))).toHaveLength(
    1,
  );
  expect((await repo.read()).contents[contentId]!.publications).toHaveLength(1);
}, 120_000);
it("defaults remain supervised/dry-run and all live switches must independently authorize policy publication", async () => {
  const defaults = loadAutomationConfig({});
  expect(defaults.mode).toBe("supervised");
  expect(defaults.dryRun).toBe(true);
  expect(defaults.enableAutoPublish).toBe(false);
  expect(defaults.enableRealPublishing).toBe(false);
  expect(decision().verdict, JSON.stringify(decision())).toBe("auto_publish");
  expect(
    decision(base, candidate, { ...liveConfig(), enableAutoPublish: false })
      .reason,
  ).toContain("auto_publish_kill_switch_disabled");
  for (const change of [
    { mode: "manual" as const },
    { mode: "supervised" as const },
    { enableAutoPublish: false },
    { enableRealPublishing: false },
    { dryRun: true },
  ]) {
    const s = structuredClone(base),
      item = s.contents[contentId]!;
    const cfg = liveConfig();
    const d = decision(s);
    grantPolicyApproval(s, item, d);
    s.automation!.lease = {
      owner: "test-cycle",
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    const authority = new AutomaticPublicationAuthority(
      candidate,
      () => ({ ...cfg, ...change }),
      "test-cycle",
    );
    expect(() => authority.assert(s, item)).toThrow("flags/kill switch");
  }
  const repo = await repository(),
    meta = fakeInstagram();
  await expect(
    new InstagramPublicationService(
      repo,
      meta.provider,
      new LocalMockMediaHostingProvider(),
      true,
      true,
    ).publish(contentId, "123", true),
  ).rejects.toThrow();
  expect(meta.calls).toHaveLength(0);
});
it("rejects wrong account, stale versions, fixture QA, changed bytes, source disputes, unclear rights and changed consent", () => {
  for (const [mutate, expected] of [
    [
      (s: Store) => {
        s.contents[contentId]!.status = "human_rejected";
      },
      "human_rejected_or_archived",
    ],
    [
      (s: Store) => {
        current(s.contents[contentId]!.metadata)!.data.instagramTarget = {
          accountId: "456",
          surface: "feed",
        };
      },
      "wrong_account_or_surface",
    ],
    [
      (s: Store) => {
        s.contents[contentId]!.versions.copy++;
      },
      "qa_rights_or_current_versions_failed",
    ],
    [
      (s: Store) => {
        current(s.contents[contentId]!.reviews)!.data.simulated = true;
      },
      "real_independent_visual_qa_required",
    ],
    [
      (s: Store) => {
        current(s.contents[contentId]!.assets)!.data[0]!.metadata.sha256 =
          "changed";
      },
      "missing_or_changed_asset",
    ],
    [
      (s: Store) => {
        Object.values(s.events)[0]!.data.claims[0]!.status = "disputed";
      },
      "source_ledger_changed",
    ],
    [
      (s: Store) => {
        current(s.contents[contentId]!.assets)!.data[0]!.rights =
          "unknown" as never;
      },
      "qa_rights_or_current_versions_failed",
    ],
  ] as const) {
    const s = structuredClone(base);
    mutate(s);
    expect(decision(s).reason).toContain(expected);
  }
  const changed = structuredClone(candidate);
  changed.consent.allowAutomatic = false;
  expect(decision(base, changed).reason).toContain(
    "automation_input_or_consent_changed",
  );
  const s = structuredClone(base);
  current(s.contents[contentId]!.metadata)!.data.automationCandidateKey =
    candidateKey(changed);
  expect(decision(s, changed).verdict).toBe("needs_human_approval");
  changed.consent.allowAutomatic = true;
  changed.consent.risk = "sensitive";
  current(s.contents[contentId]!.metadata)!.data.automationCandidateKey =
    candidateKey(changed);
  expect(decision(s, changed).verdict).toBe("needs_human_approval");
});
it("holds scheduled results, editorial windows and saturation, with Buenos Aires overnight logic", () => {
  const c = structuredClone(candidate),
    s = structuredClone(base);
  c.timing = {
    mode: "scheduled_at",
    at: new Date(Date.now() + 86400000).toISOString(),
  };
  current(s.contents[contentId]!.metadata)!.data.automationCandidateKey =
    candidateKey(c);
  expect(decision(s, c).reason).toContain("scheduled_at_not_due");
  const cfg = {
    ...liveConfig(),
    bypassWindowEventTypes: [],
    windows: [{ days: [1], start: "22:00", end: "02:00" }],
  };
  expect(inEditorialWindow(new Date("2026-10-27T04:00:00Z"), cfg)).toBe(true); // Tue 01:00, Monday's window
  expect(inEditorialWindow(new Date("2026-10-27T06:00:00Z"), cfg)).toBe(false);
  const item = s.contents[contentId]!;
  current(item.metadata)!.data.automationCandidateKey = candidateKey(candidate);
  item.publications.push({
    id: "test-only",
    provider: "instagram",
    status: "published",
    publishedAt: new Date().toISOString(),
    instagram: { accountId: "123" },
    packageHash: "previous-version",
  } as ContentItem["publications"][number]);
  expect(decision(s).reason).toContain("recent_post_minimum_gap");
  expect(
    decision(s, candidate, { ...liveConfig(), maxPosts24Hours: 1 }).reason,
  ).toContain("daily_saturation_limit");
});
it("deduplicates the persistent manual inbox and keeps source verification separate from consent", async () => {
  const path = join(directory, "queue.json"),
    q = new ManualQueueContentSource(new FileRepository(path));
  expect((await q.enqueue(candidate)).duplicate).toBe(false);
  expect((await q.enqueue({ ...candidate, id: "another-id" })).duplicate).toBe(
    true,
  );
  expect(
    await new ManualQueueContentSource(new FileRepository(path)).discover(),
  ).toHaveLength(1);
  const bad = structuredClone(candidate);
  bad.event.claims[0]!.status = "disputed";
  expect(sourceEligibility(bad, liveConfig()).verdict).toBe(
    "needs_human_approval",
  );
  bad.timing = { mode: "hold_until", at: "2026-10-25T10:00:00" };
  bad.event = structuredClone(candidate.event);
  expect(() => validateCandidate(bad)).toThrow("UTC offset");
});
it("excludes concurrent cycles and recovers expired leases with an interrupted audit record", async () => {
  const repo = await repository();
  let release!: () => void;
  const pending = new Promise<void>((r) => {
    release = r;
  });
  let discovered!: () => void;
  const entered = new Promise<void>((r) => {
    discovered = r;
  });
  const first = runAutoCycle({
    repository: repo,
    source: {
      name: "pending",
      discover: async () => {
        discovered();
        await pending;
        return [];
      },
    },
    config: autoConfig,
  });
  await entered;
  await expect(
    runAutoCycle({ repository: repo, source, config: autoConfig }),
  ).rejects.toThrow("already active");
  release();
  await first;
  expect((await repo.read()).automation!.lease).toBeUndefined();
  await repo.transaction(async (s) => {
    s.automation!.cycles[0]!.status = "running";
    s.automation!.lease = {
      owner: "expired",
      expiresAt: "2000-01-01T00:00:00Z",
    };
    s.automation!.candidates = {};
  });
  await runAutoCycle({
    repository: repo,
    source: { name: "empty", discover: async () => [] },
    config: autoConfig,
  });
  expect((await repo.read()).automation!.cycles[0]!.status).toBe("interrupted");
});
it("revalidates the kill switch immediately before media_publish", async () => {
  const repo = await repository(),
    meta = fakeInstagram();
  const cfg = liveConfig();
  const original = meta.provider.waitForContainer.bind(meta.provider);
  meta.provider.waitForContainer = async (id) => {
    const result = await original(id);
    cfg.enableAutoPublish = false;
    return result;
  };
  const report = await runAutoCycle({
    repository: repo,
    source,
    config: () => cfg,
    executor,
    settings: geminiSettings(),
    provider: meta.provider,
    hosting: new LocalMockMediaHostingProvider(),
    fixtureHTTP: true,
  });
  expect(report.counters.failed).toBe(1);
  expect(meta.calls.some((p) => p.endsWith("/media_publish"))).toBe(false);
});
it("does not call paid AI when the target is absent or unverified input requires human review", async () => {
  const repo = new MemoryRepository(),
    fake = new FakeGeminiExecutor();
  const report = await runAutoCycle({
    repository: repo,
    source,
    config: () => ({ ...autoConfig(), accountId: "" }),
    executor: fake,
  });
  expect(report.counters.held).toBe(1);
  expect(fake.calls).toHaveLength(0);
  expect(report.entries[0]?.reason).toContain("target_account_not_configured");
});
it("removing a queued key before discovery persists a cancellation that policy cannot approve", async () => {
  const repo = await repository();
  const queue = new ManualQueueContentSource(repo);
  await queue.enqueue(candidate);
  await queue.remove(candidateKey(candidate), "human-test-only");
  expect(await queue.discover()).toHaveLength(0);
  expect(decision(await repo.read()).reason).toContain(
    "input_removed_from_queue",
  );
  const meta = fakeInstagram();
  const report = await runAutoCycle({
    repository: repo,
    source,
    config: liveConfig,
    executor,
    settings: geminiSettings(),
    provider: meta.provider,
    hosting: new LocalMockMediaHostingProvider(),
    fixtureHTTP: true,
  });
  expect(report.counters.published).toBe(0);
  expect(meta.calls).toHaveLength(0);
});
it("per-cycle call reservation prevents the next paid request", async () => {
  const repo = new MemoryRepository(),
    fake = new FakeGeminiExecutor();
  const report = await runAutoCycle({
    repository: repo,
    source,
    config: () => ({ ...autoConfig(), maxLlmCallsPerCycle: 1 }),
    executor: fake,
    settings: geminiSettings(),
    fixtureHTTP: true,
  });
  expect(fake.calls).toHaveLength(1);
  expect(report.counters.failed).toBe(1);
  expect(report.llmCalls).toBe(1);
});
it("a new authorized envelope replaces source assets, while edits outside the queue are held", async () => {
  const repo = await repository(),
    fake = new FakeGeminiExecutor(),
    cfg = autoConfig();
  await repo.transaction(async (s) => {
    s.automation!.candidates = {};
  });
  const c = structuredClone(candidate);
  c.id = "revised-input";
  c.assets = structuredClone(
    current(base.contents[contentId]!.assets)!.data.filter(
      (a) => a.stage !== "rendered",
    ),
  );
  c.assets[0]!.credit = "Updated owned asset credit";
  c.assets[0]!.id = "updated-owned-icon";
  const settings = geminiSettings();
  settings.classes.FAST.maxCalls = 10;
  const result = await runAutoCycle({
    repository: repo,
    source: { name: "manual", discover: async () => [c] },
    config: () => cfg,
    executor: fake,
    settings,
    fixtureHTTP: true,
    outputDirectory: join(directory, "revised-render"),
  });
  expect(result.counters.failed, JSON.stringify(result)).toBe(0);
  expect(result.counters.generated, JSON.stringify(result)).toBe(1);
  const item = (await repo.read()).contents[contentId]!;
  expect(
    current(item.assets)!.data.find((a) => a.stage !== "rendered")!.credit,
  ).toBe("Updated owned asset credit");
  expect(current(item.metadata)!.data.automationCandidateKey).toBe(
    candidateKey(c),
  );
  await repo.transaction(async (s) => {
    current(s.contents[contentId]!.assets)!.data[0]!.credit = "Unqueued edit";
  });
  const held = await runAutoCycle({
    repository: repo,
    source: { name: "manual", discover: async () => [c] },
    config: () => cfg,
    executor: fake,
    settings,
    fixtureHTTP: true,
  });
  expect(held.entries[0]?.reason).toContain(
    "source_inventory_changed_requeue_event",
  );
});
