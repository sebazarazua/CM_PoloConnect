import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { ensure, redact } from "./common/core.js";
import { FileRepository } from "./persistence/repository.js";
import { PrismaRepository } from "./persistence/prisma-repository.js";
import { CommunityManagerOrchestrator } from "./orchestration/community-manager.js";
import { mockProviders } from "./providers/mock/index.js";
import { instagramConfig } from "./integrations/instagram/config.js";
import { InstagramVault } from "./integrations/instagram/vault.js";
import { InstagramOAuth } from "./integrations/instagram/oauth.js";
import { InstagramPublishingProvider } from "./integrations/instagram/provider.js";
import { InstagramError } from "./integrations/instagram/errors.js";
import {
  instagramStatus,
  startInstagramServer,
} from "./integrations/instagram/server.js";
import {
  s3Settings,
  S3MediaHostingProvider,
} from "./integrations/instagram/hosting.js";
import {
  InstagramPublicationService,
  publicationSummary,
} from "./integrations/instagram/service.js";
import {
  prepareInstagramDemo,
  bindInstagramTarget,
} from "./integrations/instagram/workflow.js";
import { current } from "./domain/models.js";
import { packageHash } from "./approvals/service.js";
import { buildPublicationPackage } from "./integrations/instagram/publication-package.js";

if (existsSync(".env")) process.loadEnvFile(".env");
const { values } = parseArgs({
  args: process.argv.slice(3),
  options: {
    id: { type: "string" },
    actor: { type: "string" },
    file: { type: "string" },
    fixture: { type: "boolean" },
    "confirm-test": { type: "string" },
    "publication-id": { type: "string" },
    "media-id": { type: "string" },
  },
});
const command = process.argv[2] ?? "status",
  config = instagramConfig(),
  vault = new InstagramVault(config.secretDirectory);
const repository =
  process.env.REPOSITORY === "postgres"
    ? new PrismaRepository()
    : new FileRepository(
        resolve(
          values.file ?? process.env.DATA_FILE ?? ".local/editorial.json",
        ),
      );
const print = (data: unknown) =>
  console.log(JSON.stringify(redact(data), null, 2));
async function main() {
  if (command === "status") {
    const hosting = s3Settings();
    print({
      ...(await instagramStatus(config, vault)),
      oauthConfigured: !!config.clientId && !!config.clientSecret,
      hostingConfigured: !!hosting.bucket && !!hosting.region,
      hosting: "s3_private_presigned_get",
      redirectURI: config.redirectURI,
      publication: "explicit CLI required",
    });
    return;
  }
  if (command === "connect") {
    const { server, setupKey } = await startInstagramServer(config, vault);
    const local =
      process.env.INSTAGRAM_PROXY_MODE === "true"
        ? new URL(config.redirectURI).origin
        : `https://localhost:${config.port}`;
    print({
      listening: "127.0.0.1",
      open: `${local}/?setup=${setupKey}`,
      redirectURI: config.redirectURI,
      localCertificate:
        "Self-signed development certificate; accept it in your browser before OAuth, or configure a trusted certificate / HTTPS tunnel",
      publishing: "disabled here; OAuth does not publish",
    });
    await new Promise<void>((resolve) => {
      process.once("SIGINT", () => server.close(() => resolve()));
      process.once("SIGTERM", () => server.close(() => resolve()));
    });
    return;
  }
  if (command === "refresh") {
    await new InstagramOAuth(config, vault).refresh();
    print(await instagramStatus(config, vault));
    return;
  }
  if (command === "disconnect") {
    await new InstagramOAuth(config, vault).disconnect();
    print({ connected: false, revoked: true });
    return;
  }
  if (command === "publications") {
    const s = await repository.read();
    print(
      Object.values(s.contents)
        .filter((c) => !values.id || values.id === c.id)
        .flatMap((c) => c.publications.map(publicationSummary)),
    );
    return;
  }
  if (command === "cleanup") {
    const hosting = new S3MediaHostingProvider(s3Settings()),
      state = await repository.read();
    let deleted = 0;
    for (const c of Object.values(state.contents))
      for (const p of c.publications) {
        const record = p.instagram,
          hosted = record?.hosted;
        if (
          hosted &&
          !record.cleanedAt &&
          Date.parse(hosted.cleanupAfter) <= Date.now() &&
          p.status !== "publishing" &&
          p.status !== "unknown"
        ) {
          await hosting.delete(hosted);
          await repository.transaction(async (s) => {
            s.contents[c.id]!.publications.find(
              (x) => x.id === p.id,
            )!.instagram!.cleanedAt = new Date().toISOString();
          });
          deleted++;
        }
      }
    for (const [key, record] of Object.entries(
      state.automation?.dryRunMedia ?? {},
    )) {
      if (
        !record.cleanedAt &&
        Date.parse(record.hosted.cleanupAfter) <= Date.now()
      ) {
        await hosting.delete(record.hosted);
        await repository.transaction(async (s) => {
          s.automation!.dryRunMedia[key]!.cleanedAt = new Date().toISOString();
        });
        deleted++;
      }
    }
    hosting.close();
    print({ deleted });
    return;
  }
  const connection = vault.connection();
  // An offline fixture preview can use an explicitly fictitious target; it remains unpublishable.
  const accountId =
    connection?.accountId ?? (values.fixture ? "000000000000000" : "");
  if (command === "demo-real") {
    print(
      await prepareInstagramDemo(repository, accountId, {
        fixture: values.fixture,
        contentId: values.id,
        actor: values.actor,
      }),
    );
    return;
  }
  ensure(
    connection,
    "Instagram is not connected; run cm:instagram:connect first",
  );
  if (command === "reconcile") {
    ensure(
      values.id &&
        values["publication-id"] &&
        values["media-id"] &&
        values.actor,
      "Reconciliation requires --id, --publication-id, --media-id and --actor after visually verifying the post on Instagram",
    );
    const service = new InstagramPublicationService(
      repository,
      new InstagramPublishingProvider(config, connection),
      new S3MediaHostingProvider(s3Settings()),
      config.enabled,
    );
    print(
      publicationSummary(
        await service.reconcile(
          values.id,
          values["publication-id"],
          accountId,
          values["media-id"],
          values.actor,
        ),
      ),
    );
    return;
  }
  if (command === "prepare") {
    ensure(
      values.id && values.actor,
      "Preparing a target requires --id and --actor",
    );
    const cm = new CommunityManagerOrchestrator(repository, mockProviders());
    const c = await bindInstagramTarget(cm, values.id, accountId, values.actor);
    print({
      contentId: c.id,
      status: c.status,
      next: "cm:demo-real -- --id CONTENT_ID to regenerate/review before approval",
    });
    return;
  }
  if (command === "package") {
    ensure(values.id, "Use --id CONTENT_ID");
    const s = await repository.read(),
      c = s.contents[values.id];
    ensure(c, "Unknown content ID");
    print(await buildPublicationPackage(s, c, accountId));
    return;
  }
  ensure(
    command === "publish-real" || command === "test-publish",
    `Unknown Instagram command: ${command}`,
  );
  if (!config.enabled) throw new InstagramError("publishing_disabled");
  const provider = new InstagramPublishingProvider(config, connection);
  let contentId = values.id;
  if (command === "test-publish") {
    ensure(
      values.actor?.trim(),
      "Test publish requires --actor identifying the human reviewer",
    );
    const profile = await provider.checkConnection();
    if (!contentId) {
      const prepared = await prepareInstagramDemo(repository, accountId, {
        actor: values.actor,
      });
      print(prepared);
      contentId = prepared.contentId;
    }
    const state = await repository.read(),
      c = state.contents[contentId];
    ensure(c, "Unknown test content");
    const event = Object.values(state.events).find((e) => e.id === c.eventId);
    ensure(
      event?.data.simulated === true &&
        /^PRUEBA TÉCNICA/.test(current(c.copies)?.data.outputs.caption ?? ""),
      "test-publish only accepts the explicitly labelled controlled demo",
    );
    print({
      account: profile,
      contentId,
      caption: current(c.copies)?.data.outputs.caption,
      finalFiles: current(c.assets)
        ?.data.filter((a) => a.stage === "rendered")
        .map((a) => a.storageRef),
      packageHash: packageHash(c),
    });
    const expected = `PUBLICAR_PRUEBA:${accountId}`;
    let confirmation = values["confirm-test"];
    if (!confirmation && process.stdin.isTTY) {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        confirmation = await rl.question(
          `Revisá la imagen y el caption. Para aprobar y PUBLICAR, escribí ${expected}: `,
        );
      } finally {
        rl.close();
      }
    }
    ensure(
      confirmation === expected,
      "Explicit test publication confirmation missing or wrong account",
    );
    if (c.status === "ready_for_human_approval") {
      const cm = new CommunityManagerOrchestrator(repository, mockProviders());
      await cm.approveContent(
        c.id,
        values.actor!,
        packageHash(c),
        "Explicit manual CLI approval of controlled Instagram test image/caption/account",
      );
    }
  }
  ensure(contentId, "Use --id CONTENT_ID");
  const receipt = await new InstagramPublicationService(
    repository,
    provider,
    new S3MediaHostingProvider(s3Settings()),
    config.enabled,
  ).publish(contentId, accountId, true);
  print(publicationSummary(receipt));
}
try {
  await main();
} catch (error) {
  print(
    error instanceof InstagramError
      ? { error: error.toJSON() }
      : {
          error: "blocked_or_configuration_error",
          message:
            error instanceof Error
              ? error.message
              : "Instagram operation failed",
        },
  );
  process.exitCode = 1;
} finally {
  await repository.close();
}
