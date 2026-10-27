import { hash, ensure } from "../common/core.js";
import { demoEvent } from "../providers/mock/index.js";
import type { EditorialRepository } from "../persistence/repository.js";
import { OutputValidator, SkillRegistry } from "../skills/runtime.js";
import { emptyAutomation, type ContentCandidate } from "./types.js";
export interface ContentSourceProvider {
  readonly name: string;
  discover(): Promise<ContentCandidate[]>;
}
export interface PoloConnectDataSource extends ContentSourceProvider {
  readonly name: "polo-connect-data";
}
export interface ExternalPoloSources extends ContentSourceProvider {
  readonly name: "external-polo-sources";
}
export function candidateKey(c: ContentCandidate): string {
  return hash({
    logicalKey: c.logicalKey,
    eventId: c.event.event_id,
    type: c.event.event_type,
    headline: c.event.headline_working,
    simulated: c.event.simulated === true,
    sources: c.event.sources,
    editorial: c.event.editorial,
    entities: c.event.entities,
    claims: c.event.claims,
    time: c.event.time,
    rights: c.event.rights,
    renderFacts: c.event.render_facts,
    assets: c.assets,
    consent: c.consent,
    timing: c.timing,
  });
}
export function validateCandidate(
  c: ContentCandidate,
  validator = new OutputValidator(new SkillRegistry()),
): void {
  ensure(
    c &&
      typeof c === "object" &&
      c.event &&
      typeof c.logicalKey === "string" &&
      c.logicalKey.trim() &&
      typeof c.verifiedBy === "string" &&
      c.verifiedBy.trim(),
    "Candidate requires event, logicalKey and evidence owner",
  );
  ensure(
    !["__proto__", "constructor", "prototype"].includes(c.logicalKey),
    "Reserved event key",
  );
  validator.validate("polo-news-researcher", c.event);
  ensure(
    Array.isArray(c.assets) && c.assets.length <= 6,
    "Candidate asset inventory is invalid",
  );
  ensure(
    c.consent &&
      typeof c.consent.allowAutomatic === "boolean" &&
      ["routine", "sensitive", "opinion", "ambiguous", "unknown"].includes(
        c.consent.risk,
      ),
    "Explicit automation consent/risk classification required",
  );
  ensure(
    c.timing &&
      ["publish_now", "scheduled_at", "hold_until"].includes(c.timing.mode),
    "Invalid publication timing mode",
  );
  if (c.timing.mode !== "publish_now")
    ensure(
      typeof c.timing.at === "string" &&
        Number.isFinite(Date.parse(c.timing.at)) &&
        /(?:[zZ]|[+-]\d\d:\d\d)$/.test(c.timing.at),
      "Timing requires an ISO timestamp with UTC offset",
    );
}
export class FixtureContentSource implements ContentSourceProvider {
  readonly name = "fixture";
  async discover(): Promise<ContentCandidate[]> {
    const event = demoEvent();
    return [
      {
        id: "fixture-structured-result",
        logicalKey: event.logicalKey,
        event: event.candidate,
        assets: [],
        verifiedBy: "fixture-evidence-owner",
        consent: { allowAutomatic: false, risk: "routine" },
        timing: { mode: "publish_now" },
      },
    ];
  }
}
/** A durable manual inbox in the same repository; no extra queue service. */
export class ManualQueueContentSource implements ContentSourceProvider {
  readonly name = "manual_queue";
  constructor(private repository: EditorialRepository) {}
  async discover() {
    return structuredClone(
      (await this.repository.read()).automation?.queue ?? [],
    );
  }
  async enqueue(candidate: ContentCandidate) {
    validateCandidate(candidate);
    return this.repository.transaction(async (store) => {
      const automation = (store.automation ??= emptyAutomation()),
        key = candidateKey(candidate),
        existing = automation.queue.find((c) => candidateKey(c) === key);
      if (existing) return { key, duplicate: true };
      automation.queue.push(structuredClone(candidate));
      return { key, duplicate: false };
    });
  }
  async remove(identifier: string, actor: string) {
    ensure(
      identifier.trim() && actor.trim(),
      "Queue removal requires identifier and actor",
    );
    return this.repository.transaction(async (store) => {
      const state = (store.automation ??= emptyAutomation());
      for (const candidate of state.queue) {
        const key = candidateKey(candidate);
        if (
          (key === identifier || candidate.id === identifier) &&
          !state.candidates[key]
        )
          state.candidates[key] = {
            key,
            candidate: structuredClone(candidate),
            source: this.name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
      }
      for (const record of Object.values(state.candidates)) {
        if (record.key === identifier || record.candidate.id === identifier) {
          record.verdict = "reject";
          record.reason = ["input_removed_from_queue"];
        }
      }
      state.queue = state.queue.filter(
        (c) => candidateKey(c) !== identifier && c.id !== identifier,
      );
      store.audit.push({
        id: `queue-remove-${hash({ identifier, actor, at: new Date().toISOString() })}`,
        contentId: null,
        kind: "automation_queue_removed",
        at: new Date().toISOString(),
        detail: { actor, identifier },
      });
      return { removed: identifier };
    });
  }
}
