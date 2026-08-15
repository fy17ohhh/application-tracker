import Dexie, { type EntityTable } from "dexie";
import type { Application, ApplicationEvent, Settings, SyncQueueItem } from "./schemas";

export class ApplicationTrackerDatabase extends Dexie {
  applications!: EntityTable<Application, "id">;
  applicationEvents!: EntityTable<ApplicationEvent, "id">;
  settings!: EntityTable<Settings, "id">;
  syncQueue!: EntityTable<SyncQueueItem, "id">;

  constructor(name = "application-tracker") {
    super(name);
    this.version(1).stores({
      applications:
        "id, fingerprint, type, status, organization, sourceDomain, deadline, appliedAt, nextActionAt, createdAt, updatedAt, *tags",
      applicationEvents: "id, applicationId, type, occurredAt, toStatus",
      settings: "id",
      syncQueue: "id, target, status, applicationId, nextRunAt, updatedAt"
    });
  }
}

export const db = new ApplicationTrackerDatabase();
