import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { BudgetExceeded, remainingBudget } from "./governance.js";
import type { Store } from "../domain/models.js";
import type { BudgetCharge, BudgetLimits, Usage } from "./types.js";
export interface JournalRow {
  id: string;
  workflowId: string;
  budgetCharge: BudgetCharge;
  phase: "reserved" | "settled";
  usage?: Usage;
}
/** Write-ahead accounting survives a process crash or domain transaction rollback. No prompts/secrets. */
export class UsageJournal {
  constructor(private path = resolve(".local/ai-usage.jsonl")) {}
  rows(): JournalRow[] {
    if (!existsSync(this.path)) return [];
    try {
      const rows = new Map<string, JournalRow>();
      for (const line of readFileSync(this.path, "utf8")
        .split("\n")
        .filter(Boolean)) {
        const row = JSON.parse(line) as JournalRow;
        rows.set(row.id, row);
      }
      return [...rows.values()];
    } catch {
      throw new BudgetExceeded(
        "Usage journal needs human reconciliation; no further paid calls are allowed",
        null,
        "journal",
      );
    }
  }
  private append(row: JournalRow): void {
    const fd = openSync(this.path, "a");
    try {
      appendFileSync(fd, JSON.stringify(row) + "\n", "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }
  reserve(row: JournalRow, store: Store, limits: BudgetLimits): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const lockPath = this.path + ".lock";
    let fd: number;
    try {
      fd = openSync(lockPath, "wx");
    } catch {
      throw new BudgetExceeded(
        "Usage journal locked; retry only after the active reservation completes",
        null,
        row.workflowId,
      );
    }
    try {
      const remaining = remainingBudget(
        store,
        row.workflowId,
        limits,
        this.rows(),
      );
      const c = row.budgetCharge;
      if (
        c.calls > remaining.maxCalls ||
        c.inputTokens > remaining.maxInputTokens ||
        c.outputTokens > remaining.maxOutputTokens ||
        (remaining.maxCostUsd !== null &&
          (c.costUsd === null || c.costUsd > remaining.maxCostUsd))
      )
        throw new BudgetExceeded(
          "Concurrent/reserved usage exhausted the budget",
          null,
          row.workflowId,
        );
      this.append(row);
    } finally {
      closeSync(fd);
      unlinkSync(lockPath);
    }
  }
  settle(row: JournalRow): void {
    this.append({ ...row, phase: "settled" });
  }
}
