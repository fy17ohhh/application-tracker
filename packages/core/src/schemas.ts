import { z } from "zod";

export const applicationTypeSchema = z.enum(["job", "degree"]);
export type ApplicationType = z.infer<typeof applicationTypeSchema>;

export const extractionSourceSchema = z.enum(["json-ld", "adapter", "generic-dom", "manual", "ai"]);

export const syncStatusSchema = z.enum(["idle", "pending", "synced", "failed"]);
export const syncTargetSchema = z.enum(["excel"]);

export const applicationSchema = z.object({
  id: z.string().min(1),
  type: applicationTypeSchema,
  organization: z.string().trim().min(1),
  title: z.string().trim().min(1),
  location: z.string().trim().optional(),
  status: z.string().trim().min(1),
  sourceUrl: z.string().url(),
  sourceDomain: z.string().trim().min(1),
  description: z.string().trim().optional(),
  requirements: z.array(z.string().trim()).optional(),
  salary: z
    .object({
      min: z.number().finite().optional(),
      max: z.number().finite().optional(),
      currency: z.string().trim().optional(),
      period: z.string().trim().optional()
    })
    .optional(),
  tuition: z
    .object({
      amount: z.number().finite().optional(),
      currency: z.string().trim().optional(),
      period: z.string().trim().optional()
    })
    .optional(),
  deadline: z.string().datetime().or(z.string().date()).optional(),
  appliedAt: z.string().datetime().or(z.string().date()).optional(),
  nextActionAt: z.string().datetime().or(z.string().date()).optional(),
  contact: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  tags: z.array(z.string().trim()).default([]),
  customFields: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  extractionConfidence: z.number().min(0).max(1).optional(),
  extractionSource: extractionSourceSchema,
  fingerprint: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sync: z.object({
    excel: z
      .object({
        status: syncStatusSchema,
        externalId: z.string().optional(),
        lastSyncedAt: z.string().datetime().optional(),
        error: z.string().optional()
      })
      .optional()
  })
});

export type Application = z.infer<typeof applicationSchema>;

export const applicationEventSchema = z.object({
  id: z.string().min(1),
  applicationId: z.string().min(1),
  type: z.enum(["created", "updated", "status_changed", "note_added", "synced"]),
  fromStatus: z.string().optional(),
  toStatus: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  occurredAt: z.string().datetime()
});

export type ApplicationEvent = z.infer<typeof applicationEventSchema>;

export const settingsSchema = z.object({
  id: z.string().min(1),
  locale: z.enum(["en", "zh-CN"]).default("en"),
  privacy: z
    .object({
      allowDiagnostics: z.boolean().default(false)
    })
    .default({ allowDiagnostics: false })
});
export type Settings = z.infer<typeof settingsSchema>;

export const syncQueueItemSchema = z.object({
  id: z.string().min(1),
  target: syncTargetSchema,
  operation: z.enum(["upsert_application", "delete_application"]),
  applicationId: z.string().min(1),
  payload: z.unknown(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  attempt: z.number().int().min(0),
  maxAttempts: z.number().int().min(1).default(5),
  nextRunAt: z.string().datetime(),
  lastError: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});
export type SyncQueueItem = z.infer<typeof syncQueueItemSchema>;

export const applicationDraftSchema = applicationSchema.omit({
  id: true,
  fingerprint: true,
  createdAt: true,
  updatedAt: true,
  sync: true
});
export type ApplicationDraft = z.infer<typeof applicationDraftSchema>;
