import { expect, it } from "vitest";
import { MockPublishingProvider } from "../src/providers/mock/index.js";
import { approved, createCM } from "./helpers.js";
import { packageHash } from "../src/approvals/service.js";
import { publishPackage } from "../src/domain/guards.js";
import { current } from "../src/domain/models.js";

it("publishing adapter validates, schedules idempotently, reports status and cancels", async () => {
  const cm = createCM(),
    c = await approved(cm),
    provider = new MockPublishingProvider(),
    payload = publishPackage(c);
  const at = new Date(Date.now() + 3600000).toISOString();
  const receipt = await provider.schedule(payload, at, "same-key");
  expect((await provider.validate(payload)).valid).toBe(true);
  expect(await provider.schedule(payload, at, "same-key")).toEqual(receipt);
  expect(provider.ledger.size).toBe(1);
  expect((await provider.getStatus(receipt.externalId))?.status).toBe(
    "scheduled",
  );
  await provider.deleteScheduled(receipt.externalId);
  expect((await provider.getStatus(receipt.externalId))?.status).toBe(
    "cancelled",
  );
});
it("asset changes invalidate QA and approval and require production again", async () => {
  const cm = createCM(),
    c = await approved(cm),
    assets = structuredClone(current(c.assets)!.data);
  assets[0]!.credit = "Nuevo crédito verificado";
  const edited = await cm.reviseContent(c.id, { assets }, "Editor");
  expect(edited.status).toBe("planning");
  expect(current(edited.plans)?.stale).toBe(true);
  expect(edited.approvals[0]?.invalidatedAt).toBeTruthy();
  await expect(cm.simulatePublish(c.id)).rejects.toThrow();
  await cm.runContentProduction(c.id);
  const qa = await cm.runQualityReview(c.id);
  await cm.approveContent(c.id, "Editor", packageHash(qa));
  expect("provider" in (await cm.simulatePublish(c.id))).toBe(true);
});
