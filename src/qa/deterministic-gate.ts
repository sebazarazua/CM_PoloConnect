import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import {
  current,
  isReelPlan,
  type ContentItem,
  type SkillOutputs,
  type Store,
} from "../domain/models.js";
import { assertRights } from "../domain/guards.js";
import { validApproval } from "../approvals/service.js";
import { hash } from "../common/core.js";
import type { OutputValidator } from "../skills/runtime.js";

export interface GateIssue {
  code: string;
  owner: string;
  surface: string;
  detail: string;
}
export interface GateResult {
  passed: boolean;
  issues: GateIssue[];
  sourceOfTruthHash: string;
  checks: string[];
}
const scores = (value: string) =>
  [
    ...value.matchAll(/(?<![\d-])\b(\d{1,2})\s*[-–—]\s*(\d{1,2})\b(?!-\d)/g),
  ].map((m) => `${Number(m[1])}-${Number(m[2])}`);
export class DeterministicQualityGate {
  constructor(private validator: OutputValidator) {}
  inspect(
    store: Store,
    c: ContentItem,
    event: SkillOutputs["polo-news-researcher"],
    stage: "post_render" | "pre_publish" = "post_render",
  ): GateResult {
    const issues: GateIssue[] = [];
    const fail = (
      code: string,
      owner: string,
      surface: string,
      detail: string,
    ) => issues.push({ code, owner, surface, detail });
    if (c.eventId !== event.event_id)
      fail(
        "event_id_mismatch",
        "polo-news-researcher",
        "metadata",
        "Content and verified event IDs differ",
      );
    if (
      !event.claims.length ||
      event.claims.some(
        (f) =>
          !["confirmed_primary", "confirmed_multi_source"].includes(f.status) ||
          !f.source_ids.length,
      )
    )
      fail(
        "blocked_verification",
        "polo-news-researcher",
        "facts",
        "Central facts are not verified",
      );
    const sourceIds = new Set(event.sources.map((s) => s.source_id));
    if (event.claims.some((f) => f.source_ids.some((id) => !sourceIds.has(id))))
      fail(
        "unknown_source_id",
        "polo-news-researcher",
        "facts",
        "Claim references missing source",
      );
    for (const [key, value] of Object.entries(event.time))
      if (typeof value === "string" && !Number.isFinite(Date.parse(value)))
        fail(
          "invalid_timestamp",
          "polo-news-researcher",
          key,
          "Source timestamp cannot be parsed",
        );
    try {
      assertRights(c);
    } catch {
      fail(
        "blocked_rights",
        "asset-rights-owner",
        "assets",
        "Required assets are missing/stale, outside allowed platform or without current reusable rights",
      );
    }
    const copy = current(c.copies),
      plan = current(c.plans),
      assets = current(c.assets)?.data ?? [];
    if (!copy || copy.stale)
      fail("stale_copy", "copywriter", "copy", "Current copy missing or stale");
    if (!plan || plan.stale)
      fail(
        "stale_plan",
        c.type === "reel" ? "reel-planner" : "social-designer",
        "plan",
        "Current plan missing or stale",
      );
    for (const [skill, value] of [
      ["copywriter", copy?.data],
      [c.type === "reel" ? "reel-planner" : "social-designer", plan?.data],
    ] as const) {
      if (value)
        try {
          this.validator.validate(skill, value);
        } catch {
          fail(
            "schema_validation",
            skill,
            skill,
            "Original JSON schema or behavioral validator failed",
          );
        }
    }
    const expected = new Set(event.claims.map((f) => f.claim));
    if (
      copy?.data.source_facts.some(
        (f) =>
          !expected.has(f.fact) ||
          !event.claims.some(
            (x) => x.claim === f.fact && x.status === f.verification_status,
          ),
      )
    )
      fail(
        "factual_consistency",
        "copywriter",
        "copy",
        "Copy fact ledger contradicts the verified source",
      );
    if (copy && copy.data.opportunity_id !== c.opportunity?.opportunity_id)
      fail(
        "opportunity_id_mismatch",
        "copywriter",
        "copy",
        "Copy belongs to another opportunity",
      );
    if (plan && plan.data.opportunity_id !== c.opportunity?.opportunity_id)
      fail(
        "opportunity_id_mismatch",
        c.type === "reel" ? "reel-planner" : "social-designer",
        "plan",
        "Plan belongs to another opportunity",
      );
    if (plan && isReelPlan(plan.data) !== (c.type === "reel"))
      fail(
        "format_mismatch",
        "content-opportunity-detector",
        "plan",
        "Creative plan does not match selected format",
      );
    const assetIds = new Set(assets.map((a) => a.id));
    if (assetIds.size !== assets.length)
      fail(
        "duplicate_asset_id",
        "asset-rights-owner",
        "assets",
        "Duplicate asset ID",
      );
    for (const a of assets)
      if (
        !a.storageRef ||
        (isAbsolute(a.storageRef) && !existsSync(a.storageRef))
      )
        fail(
          "missing_asset",
          "asset-rights-owner",
          "assets",
          `Missing asset ${a.id}`,
        );
    if (plan) {
      const refs = isReelPlan(plan.data)
        ? plan.data.footage
            .filter((f) => f.selection_status !== "avoid")
            .map((f) => f.source_id)
        : plan.data.assets.map((a) => a.asset_id);
      if (refs.some((id) => !assetIds.has(id)))
        fail(
          "missing_asset",
          "asset-rights-owner",
          "plan",
          "Plan references assets absent from selected inventory",
        );
    }
    if (event.event_type === "match_result") {
      const known = new Set(event.claims.flatMap((f) => scores(f.claim)));
      const surfaces: Array<[string, string, string]> = [
        ["copy", "copywriter", JSON.stringify(copy?.data.outputs ?? {})],
      ];
      if (plan)
        surfaces.push([
          "design",
          c.type === "reel" ? "reel-planner" : "social-designer",
          JSON.stringify(
            isReelPlan(plan.data)
              ? { text: plan.data.text, cover: plan.data.cover }
              : plan.data.slides,
          ),
        ]);
      for (const [surface, owner, value] of surfaces)
        if (scores(value).some((s) => !known.has(s)))
          fail(
            "score_mismatch",
            owner,
            surface,
            "Score differs from verified event; no LLM comparison is necessary",
          );
    }
    const metadata = current(c.metadata)?.data ?? {};
    const record = Object.values(store.events).find(
      (e) => e.id === event.event_id,
    );
    if (record && metadata.eventRevision !== record.revision)
      fail(
        "stale_event_revision",
        "polo-news-researcher",
        "metadata",
        "Content metadata does not reference the current verified event revision",
      );
    for (const [label, actual, expectedVersion] of [
      ["asset", current(c.assets)?.version, c.versions.asset],
      ["copy", copy?.version, c.versions.copy],
      ["metadata", current(c.metadata)?.version, c.versions.metadata],
    ] as const)
      if (actual !== expectedVersion)
        fail(
          "version_mismatch",
          "human-editor",
          label,
          "Revision and active version counter differ",
        );
    const visible = JSON.stringify(copy?.data.outputs ?? {});
    const knownDates = new Set(
      Object.values(event.time)
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.slice(0, 10)),
    );
    const knownTimes = new Set(
      Object.values(event.time)
        .filter((v): v is string => typeof v === "string")
        .flatMap((v) => v.match(/(?<=T)\d{2}:\d{2}/g) ?? []),
    );
    for (const value of visible.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [])
      if (!knownDates.has(value))
        fail(
          "date_mismatch",
          "copywriter",
          "copy",
          "Displayed date is not present in the source-of-truth ledger",
        );
    for (const value of visible.match(/\b(?:[01]\d|2[0-3]):[0-5]\d\b/g) ?? [])
      if (!knownTimes.has(value))
        fail(
          "time_mismatch",
          "copywriter",
          "copy",
          "Displayed time is not present in the verified event schedule",
        );
    const names = new Set(event.entities.map((e) => e.canonical_name));
    const checkNames = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(checkNames);
        return;
      }
      if (value && typeof value === "object")
        for (const [key, v] of Object.entries(value)) {
          if (
            [
              "canonical_name",
              "team_name",
              "player_name",
              "horse_name",
            ].includes(key) &&
            typeof v === "string" &&
            !names.has(v)
          )
            fail(
              "canonical_name_mismatch",
              "polo-news-researcher",
              "metadata",
              "Structured entity name differs from verified canonical names",
            );
          else checkNames(v);
        }
    };
    checkNames(metadata);
    if (plan) checkNames(plan.data);
    if (
      plan &&
      !isReelPlan(plan.data) &&
      ((c.type === "carousel" && plan.data.output.structure !== "carousel") ||
        (c.type === "story" &&
          !["story", "story_sequence"].includes(plan.data.output.structure)))
    )
      fail(
        "format_mismatch",
        "social-designer",
        "plan",
        "Output structure does not match the content format",
      );
    if (metadata.eventId && metadata.eventId !== event.event_id)
      fail(
        "event_id_mismatch",
        "polo-news-researcher",
        "metadata",
        "Metadata event ID differs",
      );
    const approvedLinks = Array.isArray(metadata.links)
      ? metadata.links.filter((v): v is string => typeof v === "string")
      : [];
    if (metadata.requiresLink === true && !approvedLinks.length)
      fail(
        "missing_cta_link",
        "copywriter",
        "copy",
        "CTA requires a verified destination",
      );
    for (const url of JSON.stringify(copy?.data.outputs ?? {}).match(
      /https?:\/\/[^\s"<>]+/g,
    ) ?? [])
      if (!approvedLinks.includes(url))
        fail(
          "unapproved_link",
          "copywriter",
          "copy",
          "Copy includes a destination not supplied in approved metadata",
        );
    for (const other of Object.values(store.contents))
      if (
        other.id !== c.id &&
        c.opportunity &&
        other.opportunity?.opportunity_id === c.opportunity.opportunity_id &&
        other.eventId === c.eventId &&
        other.type === c.type &&
        ["published", "ready_to_publish", "human_approved"].includes(
          other.status,
        )
      )
        fail(
          "duplicate_opportunity",
          "content-opportunity-detector",
          "opportunity",
          "Same opportunity already produced or scheduled",
        );
    if (stage === "pre_publish" && !validApproval(c))
      fail(
        "invalid_approval",
        "human-editor",
        "approval",
        "Approval is absent, stale or version-mismatched",
      );
    return {
      passed: issues.length === 0,
      issues,
      sourceOfTruthHash: hash({
        id: event.event_id,
        claims: event.claims,
        entities: event.entities,
        time: event.time,
      }),
      checks: [
        "facts",
        "scores",
        "timestamps",
        "ids",
        "asset_inventory",
        "rights",
        "schemas",
        "versions",
        "duplicates",
        "cta_destinations",
        "format",
        ...(stage === "pre_publish" ? ["human_approval"] : []),
      ],
    };
  }
}
