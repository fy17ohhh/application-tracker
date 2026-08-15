import { applicationSchema, applicationEventSchema, settingsSchema, syncQueueItemSchema } from "./schemas";
import type { ApplicationTrackerDatabase } from "./db";
import { db as defaultDb } from "./db";

export async function exportBackup(database: ApplicationTrackerDatabase = defaultDb): Promise<string> {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    applications: await database.applications.toArray(),
    applicationEvents: await database.applicationEvents.toArray(),
    settings: await database.settings.toArray(),
    syncQueue: await database.syncQueue.toArray()
  };
  return JSON.stringify(backup, null, 2);
}

export async function restoreBackup(json: string, database: ApplicationTrackerDatabase = defaultDb): Promise<void> {
  const parsed = JSON.parse(json) as {
    applications?: unknown[];
    applicationEvents?: unknown[];
    settings?: unknown[];
    syncQueue?: unknown[];
  };
  const applications = (parsed.applications ?? []).map((item) => applicationSchema.parse(item));
  const events = (parsed.applicationEvents ?? []).map((item) => applicationEventSchema.parse(item));
  const settings = (parsed.settings ?? []).map((item) => settingsSchema.parse(item));
  const queue = (parsed.syncQueue ?? []).map((item) => syncQueueItemSchema.parse(item));
  await database.transaction("rw", database.applications, database.applicationEvents, database.settings, database.syncQueue, async () => {
    await database.applications.bulkPut(applications);
    await database.applicationEvents.bulkPut(events);
    await database.settings.bulkPut(settings);
    await database.syncQueue.bulkPut(queue);
  });
}
