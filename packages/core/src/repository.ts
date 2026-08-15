import { nanoid } from "nanoid";
import type { ApplicationTrackerDatabase } from "./db";
import { db as defaultDb } from "./db";
import {
  applicationEventSchema,
  applicationSchema,
  type Application,
  type ApplicationDraft,
  type ApplicationEvent
} from "./schemas";
import { createApplication, nowIso } from "./utils";

export type DuplicateResolution = "warn" | "overwrite" | "merge" | "new";

export interface SaveResult {
  application: Application;
  duplicate?: Application | undefined;
  action: "created" | "updated" | "duplicate-warning";
}

export class ApplicationRepository {
  constructor(private readonly database: ApplicationTrackerDatabase = defaultDb) {}

  async list(): Promise<Application[]> {
    return this.database.applications.orderBy("updatedAt").reverse().toArray();
  }

  async get(id: string): Promise<Application | undefined> {
    return this.database.applications.get(id);
  }

  async findDuplicate(fingerprint: string): Promise<Application | undefined> {
    return this.database.applications.where("fingerprint").equals(fingerprint).first();
  }

  async saveDraft(draft: ApplicationDraft, resolution: DuplicateResolution): Promise<SaveResult> {
    const candidate = applicationSchema.parse(createApplication(draft));
    const duplicate = await this.findDuplicate(candidate.fingerprint);
    if (duplicate && resolution === "warn") {
      return { application: candidate, duplicate, action: "duplicate-warning" };
    }

    if (duplicate && resolution !== "new") {
      const merged: Application =
        resolution === "merge"
          ? {
              ...duplicate,
              ...candidate,
              id: duplicate.id,
              tags: Array.from(new Set([...duplicate.tags, ...candidate.tags])),
              customFields: { ...duplicate.customFields, ...candidate.customFields },
              createdAt: duplicate.createdAt,
              updatedAt: nowIso(),
              sync: duplicate.sync
            }
          : { ...candidate, id: duplicate.id, createdAt: duplicate.createdAt, updatedAt: nowIso() };
      applicationSchema.parse(merged);
      await this.database.transaction(
        "rw",
        this.database.applications,
        this.database.applicationEvents,
        async () => {
          await this.database.applications.put(merged);
          await this.addEvent({
            applicationId: merged.id,
            type: duplicate.status === merged.status ? "updated" : "status_changed",
            fromStatus: duplicate.status,
            toStatus: merged.status,
            metadata: { duplicateResolution: resolution }
          });
        }
      );
      return { application: merged, duplicate, action: "updated" };
    }

    await this.database.transaction(
      "rw",
      this.database.applications,
      this.database.applicationEvents,
      async () => {
        await this.database.applications.add(candidate);
        await this.addEvent({ applicationId: candidate.id, type: "created" });
      }
    );
    return { application: candidate, duplicate, action: "created" };
  }

  async update(application: Application): Promise<Application> {
    const previous = await this.get(application.id);
    const next = applicationSchema.parse({ ...application, updatedAt: nowIso() });
    await this.database.transaction(
      "rw",
      this.database.applications,
      this.database.applicationEvents,
      async () => {
        await this.database.applications.put(next);
        await this.addEvent({
          applicationId: next.id,
          type: previous && previous.status !== next.status ? "status_changed" : "updated",
          fromStatus: previous?.status,
          toStatus: next.status
        });
      }
    );
    return next;
  }

  async delete(id: string): Promise<boolean> {
    const existing = await this.database.applications.get(id);
    if (!existing) return false;

    await this.database.applications.delete(id);
    const deleted = (await this.database.applications.get(id)) === undefined;
    if (!deleted) return false;

    await Promise.allSettled([
      this.database.applicationEvents.where("applicationId").equals(id).delete(),
      this.database.syncQueue.where("applicationId").equals(id).delete()
    ]);
    return true;
  }

  async addEvent(input: Omit<ApplicationEvent, "id" | "occurredAt">): Promise<ApplicationEvent> {
    const event = applicationEventSchema.parse({
      id: nanoid(),
      occurredAt: nowIso(),
      ...input
    });
    await this.database.applicationEvents.add(event);
    return event;
  }

  async events(applicationId?: string): Promise<ApplicationEvent[]> {
    const table = this.database.applicationEvents;
    if (!applicationId) return table.orderBy("occurredAt").toArray();
    return table.where("applicationId").equals(applicationId).sortBy("occurredAt");
  }
}
