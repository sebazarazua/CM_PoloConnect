import { PrismaClient, Prisma } from "@prisma/client";
import { hash, redact } from "../common/core.js";
import { emptyStore, type Store } from "../domain/models.js";
import { applyTransaction, type EditorialRepository } from "./repository.js";

const json = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(JSON.stringify(redact(value ?? {}))) as Prisma.InputJsonValue;
export class PrismaRepository implements EditorialRepository {
  constructor(
    private db: PrismaClient = new PrismaClient(),
    private namespace = "polo-connect",
  ) {}
  async read(): Promise<Store> {
    const row = await this.db.stateStore.findUnique({
      where: { id: this.namespace },
    });
    return row ? (row.data as unknown as Store) : emptyStore();
  }
  async transaction<T>(action: (s: Store) => Promise<T>): Promise<T> {
    const result = await this.db.$transaction(
      async (db) => {
        await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${this.namespace}))`;
        const row = await db.stateStore.findUnique({
          where: { id: this.namespace },
        });
        const tx = await applyTransaction(
          row ? (row.data as unknown as Store) : emptyStore(),
          action,
        );
        await this.project(db, tx.next);
        await db.stateStore.upsert({
          where: { id: this.namespace },
          create: {
            id: this.namespace,
            revision: tx.next.revision,
            data: json(tx.next),
          },
          update: { revision: tx.next.revision, data: json(tx.next) },
        });
        return tx;
      },
      { maxWait: 10000, timeout: 120000 },
    );
    if (result.error) throw result.error;
    return structuredClone(result.result) as T;
  }
  private async project(db: Prisma.TransactionClient, s: Store): Promise<void> {
    for (const event of Object.values(s.events)) {
      const row = {
        logicalKey: event.logicalKey,
        revision: event.revision,
        fingerprint: event.fingerprint,
        sourceKeys: event.sourceKeys,
        data: json(event.data),
        history: json(event.history),
      };
      await db.newsEvent.upsert({
        where: { id: event.id },
        create: { id: event.id, ...row },
        update: row,
      });
    }
    for (const c of Object.values(s.contents)) {
      const row = {
        workflowClass: c.workflowClass ?? null,
        eventId: c.eventId,
        title: c.title,
        type: c.type,
        status: c.status,
        objective: c.objective,
        audienceJob: c.audienceJob,
        priority: c.priority,
        opportunityScore: c.opportunityScore,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        versions: json(c.versions),
        blockers: json(c.blockers),
      };
      await db.contentItem.upsert({
        where: { id: c.id },
        create: { id: c.id, ...row },
        update: row,
      });
      if (c.opportunity) {
        const o = {
          contentId: c.id,
          decision: c.opportunity.decision.state,
          data: json(c.opportunity),
        };
        await db.opportunity.upsert({
          where: { contentId: c.id },
          create: { id: c.opportunity.opportunity_id, ...o },
          update: o,
        });
      }
      for (const [kind, list] of [
        ["creativePlan", c.plans],
        ["copyVersion", c.copies],
        ["assetVersion", c.assets],
        ["metadataVersion", c.metadata],
        ["qualityReview", c.reviews],
      ] as const) {
        for (const r of list) {
          const data = {
            contentId: c.id,
            version: r.version,
            stale: r.stale,
            inputHash: r.inputHash,
            data: json(r.data),
            at: new Date(r.at),
          };
          const key = `${c.id}:${kind}:${r.version}`;
          // These version tables deliberately share a storage contract, while retaining independent relations.
          switch (kind) {
            case "creativePlan":
              await db.creativePlan.upsert({
                where: { id: key },
                create: { id: key, ...data },
                update: data,
              });
              break;
            case "copyVersion":
              await db.copyVersion.upsert({
                where: { id: key },
                create: { id: key, ...data },
                update: data,
              });
              break;
            case "assetVersion":
              await db.assetVersion.upsert({
                where: { id: key },
                create: { id: key, ...data },
                update: data,
              });
              break;
            case "metadataVersion":
              await db.metadataVersion.upsert({
                where: { id: key },
                create: { id: key, ...data },
                update: data,
              });
              break;
            case "qualityReview":
              await db.qualityReview.upsert({
                where: { id: key },
                create: { id: key, ...data },
                update: data,
              });
              break;
          }
        }
      }
      for (const a of c.approvals) {
        const data = {
          contentId: c.id,
          state: a.state,
          approver: a.approver,
          at: new Date(a.at),
          versions: json(a.versions),
          packageHash: a.packageHash,
          data: json(a),
        };
        await db.approval.upsert({
          where: { id: a.id },
          create: { id: a.id, ...data },
          update: data,
        });
      }
      for (const p of c.publications) {
        const data = {
          contentId: c.id,
          provider: p.provider,
          idempotencyKey: p.idempotencyKey,
          scheduledAt: p.scheduledAt ? new Date(p.scheduledAt) : null,
          publishedAt: p.publishedAt ? new Date(p.publishedAt) : null,
          externalId: p.externalId,
          status: p.status,
          accountId: p.instagram?.accountId ?? null,
          containerId: p.instagram?.containerId ?? null,
          igMediaId: p.instagram?.igMediaId ?? null,
          permalink: p.instagram?.permalink ?? null,
          publicationPackageHash: p.instagram?.publicationPackage.packageHash ?? null,
          captionVersion: p.instagram?.captionVersion ?? null,
          assetVersion: p.instagram?.assetVersion ?? null,
          versions: json(p.versions),
          payload: json(p.payload),
          data: json(p),
        };
        await db.publication.upsert({
          where: { id: p.id },
          create: { id: p.id, ...data },
          update: data,
        });
      }
      for (const p of c.snapshots) {
        const data = {
          contentId: c.id,
          observedAt: new Date(p.observedAt),
          metrics: json(p.metrics),
          definitions: json(p.definitions),
          data: json(p),
        };
        await db.performanceSnapshot.upsert({
          where: { id: p.id },
          create: { id: p.id, ...data },
          update: data,
        });
      }
    }
    for (const l of s.learnings) {
      const key = `${l.contentId}:${l.learning_id}`;
      const data = {
        contentId: l.contentId,
        statement: l.statement,
        maturity: l.maturity,
        confidence: l.confidence,
        scope: l.scope,
        evidence: json(l.evidence),
        nextTest: l.next_test,
        data: json(l),
      };
      await db.learning.upsert({
        where: { id: key },
        create: { id: key, ...data },
        update: data,
      });
    }
    for (const r of s.runs) {
      const data = {
        workflowId: r.workflowId ?? null,
        workflowClass: r.workflowClass ?? null,
        provider: r.provider ?? null,
        model: r.model,
        llmCall: r.llmCall ?? false,
        inputTokens: r.usage?.inputTokens ?? null,
        cachedInputTokens: r.usage?.cachedInputTokens ?? null,
        outputTokens: r.usage?.outputTokens ?? null,
        reasoningTokens: r.usage?.reasoningTokens ?? null,
        totalTokens: r.usage?.totalTokens ?? null,
        estimatedInputTokens: r.estimatedInputTokens ?? null,
        latencyMs: r.latencyMs ?? null,
        actualCostUsd: r.usage?.actualCostUsd ?? null,
        estimatedCostUsd: r.usage?.estimatedCostUsd ?? null,
        costUsd: r.usage?.costUsd ?? null,
        costSource: r.usage?.costSource ?? null,
        budgetCharge: r.budgetCharge ? json(r.budgetCharge) : Prisma.JsonNull,
        selectedReferences: r.selectedReferences ?? [],
        contentId: r.contentId,
        skill: r.skill,
        inputHash: r.inputHash,
        knowledgeHash: r.knowledgeHash,
        status: r.status,
        startedAt: new Date(r.startedAt),
        endedAt: new Date(r.endedAt),
        durationMs: r.durationMs,
        attempt: r.attempt,
        input: json(r.input),
        output: json(r.output),
        data: json(r),
      };
      await db.workflowRun.upsert({
        where: { id: r.id },
        create: { id: r.id, ...data },
        update: data,
      });
    }
    for (const a of s.audit) {
      await db.auditEvent.upsert({
        where: { id: a.id },
        create: {
          id: a.id,
          contentId: a.contentId,
          kind: a.kind,
          at: new Date(a.at),
          data: json(a),
        },
        update: {},
      });
    }
    for (const p of s.strategies) {
      const key = `strategy:${p.version}`;
      await db.editorialPlan.upsert({
        where: { id: key },
        create: {
          id: key,
          version: p.version,
          data: json(p.data),
          at: new Date(p.at),
        },
        update: {},
      });
    }
    for (const b of s.benchmarks) {
      const key = hash(b);
      await db.benchmarkRecord.upsert({
        where: { id: key },
        create: { id: key, data: json(b) },
        update: {},
      });
    }
  }
  async close(): Promise<void> {
    await this.db.$disconnect();
  }
}
