import { expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  FileRepository,
  MemoryRepository,
} from "../src/persistence/repository.js";
import { createCM, approved } from "./helpers.js";

it("file persistence survives restart and stores exact approved/published versions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "polo-cm-"));
  try {
    const path = join(dir, "state.json");
    const cm = createCM(new FileRepository(path));
    const c = await approved(cm);
    await cm.simulatePublish(c.id);
    await cm.repository.close();
    const second = createCM(new FileRepository(path));
    await second.runPerformanceAnalysis(c.id);
    const s = await second.repository.read();
    expect(s.contents[c.id]?.status).toBe("analyzed");
    expect(s.learnings).toHaveLength(1);
    expect(s.contents[c.id]?.publications[0]?.versions).toEqual(
      s.contents[c.id]?.approvals[0]?.versions,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("file repository refuses a concurrent writer instead of losing edits", async () => {
  const dir = await mkdtemp(join(tmpdir(), "polo-cm-"));
  try {
    const path = join(dir, "state.json");
    await writeFile(path + ".lock", "test");
    await expect(
      new FileRepository(path).transaction(async () => 1),
    ).rejects.toThrow("locked");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
it("memory transaction queue serializes independent writers", async () => {
  const repo = new MemoryRepository();
  await Promise.all(
    Array.from({ length: 20 }, () =>
      repo.transaction(async (s) => {
        s.strategies = [];
      }),
    ),
  );
  expect((await repo.read()).revision).toBe(20);
});
