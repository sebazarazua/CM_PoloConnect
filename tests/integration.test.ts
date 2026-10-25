import { describe, expect, it } from "vitest";
import { createCM, ready, approved } from "./helpers.js";
import { packageHash, validApproval } from "../src/approvals/service.js";
import { current } from "../src/domain/models.js";
import { demoAsset, demoEvent } from "../src/providers/mock/index.js";

describe("required editorial scenarios", () => {
  it("1: confirmed result -> opportunity -> graphic -> copy -> QA -> explicit approval -> mock publish", async () => {
    const cm = createCM();
    const c = await ready(cm);
    expect(c.status).toBe("ready_for_human_approval");
    expect(c.approvals.at(-1)?.state).toBe("pending_approval");
    await expect(cm.simulatePublish(c.id)).rejects.toThrow("Human approval");
    await cm.approveContent(
      c.id,
      "Editor Demo",
      packageHash(c),
      "Verificado en fixture",
    );
    const p = await cm.simulatePublish(c.id);
    expect("provider" in p && p.provider).toBe("mock");
    const s = await cm.repository.read();
    expect(s.contents[c.id]?.status).toBe("published");
    expect(s.runs.map((r) => r.skill)).toEqual(
      expect.arrayContaining([
        "polo-news-researcher",
        "social-designer",
        "copywriter",
        "quality-reviewer",
      ]),
    );
    expect(s.contents[c.id]?.publications[0]?.versions).toEqual(
      s.contents[c.id]?.approvals.at(-1)?.versions,
    );
    expect(await cm.simulatePublish(c.id)).toEqual(p);
  });
  it("2: rumor -> blocked verification -> no production", async () => {
    const cm = createCM(),
      event = demoEvent();
    event.candidate.claims[0]!.status = "rumor";
    event.candidate.claims[0]!.confidence = "low";
    event.candidate.editorial.action_state = "monitor";
    const e = await cm.discoverEvent(event);
    const c = await cm.runOpportunityPipeline(e.id);
    expect(c.blockers[0]?.code).toBe("blocked_verification");
    expect(c.opportunity).toBeNull();
    await expect(cm.runContentProduction(c.id)).rejects.toThrow();
    expect(
      (await cm.repository.read()).runs.some(
        (r) => r.skill === "copywriter" || r.skill === "social-designer",
      ),
    ).toBe(false);
  });
  it("3: Reel footage with unknown rights is blocked before production", async () => {
    const cm = createCM();
    const [e] = await cm.runDailyDiscovery();
    const asset = demoAsset(e!.id, "reel");
    asset.rights = "rights_unknown";
    const c = await cm.runOpportunityPipeline(e!.id, "reel", [asset]);
    const result = await cm.runContentProduction(c.id);
    expect(result.status).toBe("blocked");
    expect(result.blockers[0]?.code).toBe("blocked_rights");
    expect(result.plans).toHaveLength(0);
  });
  it("4: corrected score invalidates design, copy, review and approval; regenerates from corrected facts", async () => {
    const cm = createCM();
    const c = await approved(cm),
      e = demoEvent().candidate;
    e.claims[0]!.claim = "Team Azul venció a Team Blanco por 13-10";
    e.headline_working = "Team Azul 13-10 Team Blanco";
    await cm.correctEvent(c.eventId, e, "Editor corrector");
    let changed = (await cm.repository.read()).contents[c.id]!;
    expect(current(changed.plans)?.stale).toBe(true);
    expect(current(changed.copies)?.stale).toBe(true);
    expect(changed.approvals[0]?.invalidatedAt).toBeTruthy();
    expect(validApproval(changed)).toBeUndefined();
    await expect(cm.simulatePublish(c.id)).rejects.toThrow();
    await cm.runOpportunityPipeline(c.eventId);
    await cm.runContentProduction(c.id);
    changed = await cm.runQualityReview(c.id);
    expect(current(changed.copies)?.data.outputs.caption).toContain("13-10");
    expect(changed.status).toBe("ready_for_human_approval");
    expect(changed.copies).toHaveLength(2);
    expect(changed.approvals.at(-1)?.state).toBe("pending_approval");
  });
  it("5: QA finds contradictory score and routes to copywriter", async () => {
    const cm = createCM();
    const c = await ready(cm);
    const wrong = structuredClone(current(c.copies)!.data);
    wrong.outputs.caption = "Team Azul ganó 14-10";
    wrong.source_facts[0]!.fact = "Team Azul ganó 14-10";
    await cm.reviseContent(c.id, { copy: wrong }, "Editor");
    const result = await cm.runQualityReview(c.id);
    expect(result.status).toBe("qa_failed");
    expect(result.blockers[0]?.owner).toBe("copywriter");
    await expect(
      cm.approveContent(c.id, "Editor", packageHash(result)),
    ).rejects.toThrow();
    await cm.runContentProduction(c.id);
    const fixed = await cm.runQualityReview(c.id);
    expect(fixed.status).toBe("ready_for_human_approval");
  });
  it("6: material CTA edit requires new QA and human approval, preserving original copy", async () => {
    const cm = createCM();
    const c = await approved(cm),
      copy = structuredClone(current(c.copies)!.data);
    copy.outputs.cta = "Consultá el calendario demo";
    const edited = await cm.reviseContent(c.id, { copy }, "Editor");
    expect(edited.status).toBe("ready_for_qa");
    expect(current(c.copies)?.data.outputs.cta).not.toBe(copy.outputs.cta);
    expect(edited.versions.copy).toBe(c.versions.copy + 1);
    expect(validApproval(edited)).toBeUndefined();
    await expect(cm.simulatePublish(c.id)).rejects.toThrow();
    const qa = await cm.runQualityReview(c.id);
    await expect(
      cm.approveContent(c.id, "Editor", packageHash(c)),
    ).rejects.toThrow("Version changed");
    await cm.approveContent(c.id, "Editor", packageHash(qa));
    expect("provider" in (await cm.simulatePublish(c.id))).toBe(true);
  });
  it("7: mock analytics -> evidence-bound learning -> next editorial strategy and creative context", async () => {
    const cm = createCM();
    const c = await approved(cm);
    await cm.simulatePublish(c.id);
    await cm.runPerformanceAnalysis(c.id);
    const before = await cm.repository.read();
    expect(before.learnings[0]?.simulated).toBe(true);
    expect(before.learnings[0]?.maturity).toBe("internal_observation");
    expect(before.learnings[0]?.evidence).toContain(
      before.contents[c.id]?.snapshots[0]?.id,
    );
    const plan = await cm.runWeeklyStrategyReview();
    expect(JSON.stringify(plan)).toContain(before.learnings[0]!.statement);
    const after = await cm.repository.read();
    await cm.runWeeklyStrategyReview();
    await cm.runPerformanceAnalysis(c.id);
    const repeated = await cm.repository.read();
    expect(repeated.learnings).toEqual(after.learnings);
    expect(repeated.strategies).toHaveLength(after.strategies.length);
  });
  it("8: same story from two URLs -> one logical event with both sources", async () => {
    const cm = createCM();
    const a = demoEvent(),
      b = demoEvent();
    b.candidate.event_id = "another-provider-event-id";
    b.candidate.sources[0]!.url = "https://other.example.invalid/result";
    b.candidate.sources[0]!.source_id = "source-b";
    b.candidate.claims[0]!.source_ids = ["source-b"];
    const first = await cm.discoverEvent(a);
    const second = await cm.discoverEvent(b);
    const s = await cm.repository.read();
    expect(first.id).toBe(second.id);
    expect(Object.keys(s.events)).toHaveLength(1);
    expect(second.data.sources).toHaveLength(2);
    expect(Object.keys(s.contents)).toHaveLength(1);
  });
  it("licensed Reel follows video branch; production is idempotent on unchanged input", async () => {
    const cm = createCM();
    const c = await ready(cm, "reel");
    expect(current(c.plans)?.data).toHaveProperty("reel_id");
    const before = await cm.repository.read();
    await cm.runContentProduction(c.id);
    const after = await cm.repository.read();
    expect(after.contents[c.id]?.versions).toEqual(
      before.contents[c.id]?.versions,
    );
    expect(after.runs).toHaveLength(before.runs.length);
  });
});
