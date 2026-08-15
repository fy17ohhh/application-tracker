import { nanoid } from "nanoid";
import type {
  Application,
  ApplicationTrackerDatabase,
  SyncQueueItem
} from "@application-tracker/core";
import {
  applicationEventSchema,
  db as defaultDb,
  nowIso,
  syncQueueItemSchema
} from "@application-tracker/core";

export interface IntegrationResult {
  externalId: string;
  status: "synced";
  message?: string;
}

export interface ExcelIntegration {
  id: "excel";
  syncApplication(application: Application): Promise<IntegrationResult>;
}

export class MockExcelIntegration implements ExcelIntegration {
  id = "excel" as const;
  async syncApplication(application: Application): Promise<IntegrationResult> {
    return {
      externalId: `mock-excel-${application.id}`,
      status: "synced",
      message: "Mock sync completed."
    };
  }
}

export class SyncQueueService {
  constructor(
    private readonly database: ApplicationTrackerDatabase = defaultDb,
    private readonly excel: ExcelIntegration = new MockExcelIntegration()
  ) {}

  async enqueue(target: "excel", application: Application): Promise<SyncQueueItem> {
    const timestamp = nowIso();
    const existing = await this.database.syncQueue
      .where("status")
      .anyOf("pending", "processing")
      .filter((item) => item.target === target && item.applicationId === application.id)
      .first();
    if (existing) return existing;

    const item = syncQueueItemSchema.parse({
      id: nanoid(),
      target,
      operation: "upsert_application",
      applicationId: application.id,
      payload: application,
      status: "pending",
      attempt: 0,
      maxAttempts: 5,
      nextRunAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await this.database.transaction(
      "rw",
      this.database.applications,
      this.database.syncQueue,
      async () => {
        await this.database.applications.update(application.id, {
          sync: {
            ...application.sync,
            [target]: {
              ...application.sync[target],
              status: "pending",
              error: undefined
            }
          }
        });
        await this.database.syncQueue.add(item);
      }
    );
    return item;
  }

  async syncNow(target: "excel", application: Application): Promise<void> {
    await this.enqueue(target, application);
    await this.processDue();
  }

  async processDue(now = new Date()): Promise<void> {
    await this.recoverInterruptedProcessing(now);
    const due = await this.database.syncQueue
      .where("status")
      .equals("pending")
      .filter((item) => new Date(item.nextRunAt) <= now)
      .toArray();
    for (const item of due) {
      await this.processItem(item);
    }
  }

  private async processItem(item: SyncQueueItem): Promise<void> {
    const application = await this.database.applications.get(item.applicationId);
    if (!application) {
      await this.markFailed(item, "Application no longer exists.");
      return;
    }
    await this.database.syncQueue.update(item.id, { status: "processing", updatedAt: nowIso() });
    try {
      const result = await this.excel.syncApplication(application);
      await this.database.transaction(
        "rw",
        this.database.applications,
        this.database.applicationEvents,
        this.database.syncQueue,
        async () => {
          await this.database.applications.update(application.id, {
            sync: {
              ...application.sync,
              [item.target]: {
                status: "synced",
                externalId: result.externalId,
                lastSyncedAt: nowIso()
              }
            }
          });
          await this.database.applicationEvents.add(
            applicationEventSchema.parse({
              id: nanoid(),
              applicationId: application.id,
              type: "synced",
              metadata: { target: item.target, externalId: result.externalId },
              occurredAt: nowIso()
            })
          );
          await this.database.syncQueue.update(item.id, {
            status: "completed",
            updatedAt: nowIso()
          });
        }
      );
    } catch (error) {
      await this.markFailed(item, error instanceof Error ? error.message : "Unknown sync error");
    }
  }

  private async markFailed(item: SyncQueueItem, message: string): Promise<void> {
    const attempt = item.attempt + 1;
    const failed = attempt >= item.maxAttempts;
    const nextRunAt = new Date();
    nextRunAt.setSeconds(nextRunAt.getSeconds() + Math.min(3600, 2 ** attempt * 30));
    await this.database.syncQueue.update(item.id, {
      status: failed ? "failed" : "pending",
      attempt,
      nextRunAt: nextRunAt.toISOString(),
      lastError: redact(message),
      updatedAt: nowIso()
    });
    const application = await this.database.applications.get(item.applicationId);
    if (application) {
      await this.database.applications.update(application.id, {
        sync: {
          ...application.sync,
          [item.target]: {
            ...application.sync[item.target],
            status: failed ? "failed" : "pending",
            error: redact(message)
          }
        }
      });
    }
  }

  private async recoverInterruptedProcessing(now: Date): Promise<void> {
    const staleBefore = new Date(now);
    staleBefore.setMinutes(staleBefore.getMinutes() - 2);
    const interrupted = await this.database.syncQueue
      .where("status")
      .equals("processing")
      .filter((item) => new Date(item.updatedAt) < staleBefore)
      .toArray();
    for (const item of interrupted) {
      await this.database.syncQueue.update(item.id, {
        status: "pending",
        nextRunAt: nowIso(),
        updatedAt: nowIso()
      });
    }
  }
}

export function redact(message: string): string {
  return message.replace(/(secret|token|api[_-]?key)=([^&\s]+)/gi, "$1=[redacted]");
}
