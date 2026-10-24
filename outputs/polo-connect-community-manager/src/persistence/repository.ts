import {
  readFile,
  writeFile,
  mkdir,
  open,
  rename,
  unlink,
} from "node:fs/promises";
import { dirname } from "node:path";
import { emptyStore, type Store } from "../domain/models.js";
import { CMError, redact } from "../common/core.js";

export interface EditorialRepository {
  read(): Promise<Store>;
  transaction<T>(action: (store: Store) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export async function applyTransaction<T>(
  state: Store,
  action: (store: Store) => Promise<T>,
): Promise<{ next: Store; result?: T; error?: unknown }> {
  const next = structuredClone(state);
  try {
    const result = await action(next);
    next.revision++;
    return { next, result };
  } catch (error) {
    // Roll back domain writes, retaining only diagnostic evidence of failed executions.
    const failedRuns = next.runs
      .slice(state.runs.length)
      .map((r) => ({
        ...r,
        contentId:
          r.contentId && state.contents[r.contentId] ? r.contentId : null,
      }));
    const rollback = structuredClone(state);
    rollback.runs.push(...failedRuns);
    rollback.revision++;
    rollback.audit.push(
      ...next.audit
        .slice(state.audit.length)
        .filter((a) => a.kind === "workflow_error"),
    );
    return { next: rollback, error };
  }
}
export class MemoryRepository implements EditorialRepository {
  private state: Store = emptyStore();
  private tail: Promise<unknown> = Promise.resolve();
  async read(): Promise<Store> {
    await this.tail;
    return structuredClone(this.state);
  }
  transaction<T>(action: (s: Store) => Promise<T>): Promise<T> {
    const task = this.tail.then(async () => {
      const tx = await applyTransaction(this.state, action);
      this.state = tx.next;
      if (tx.error) throw tx.error;
      return structuredClone(tx.result) as T;
    });
    this.tail = task.catch(() => {});
    return task;
  }
  async close(): Promise<void> {
    await this.tail;
  }
}
export class FileRepository implements EditorialRepository {
  constructor(private path: string) {}
  async read(): Promise<Store> {
    try {
      return JSON.parse(await readFile(this.path, "utf8")) as Store;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return emptyStore();
      throw e;
    }
  }
  async transaction<T>(action: (s: Store) => Promise<T>): Promise<T> {
    await mkdir(dirname(this.path), { recursive: true });
    const lockPath = this.path + ".lock";
    let lock;
    try {
      lock = await open(lockPath, "wx");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "EEXIST")
        throw new CMError(
          "retryable_error",
          "Repository locked by another process; retry later",
        );
      throw e;
    }
    const temp = this.path + ".tmp";
    try {
      const tx = await applyTransaction(await this.read(), action);
      await writeFile(temp, JSON.stringify(redact(tx.next), null, 2), "utf8");
      await rename(temp, this.path);
      if (tx.error) throw tx.error;
      return structuredClone(tx.result) as T;
    } finally {
      await lock.close();
      await unlink(lockPath);
    }
  }
  async close(): Promise<void> {}
}
