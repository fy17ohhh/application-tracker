import { describe, expect, it } from "vitest";
import type { Application, ApplicationEvent } from "@application-tracker/core";
import { computeDashboardMetrics, dueTodayOrThisWeek } from "./index";

const baseApp: Application = {
  id: "a1",
  type: "job",
  organization: "Acme",
  title: "Engineer",
  status: "interview",
  sourceUrl: "https://example.com/job",
  sourceDomain: "example.com",
  tags: ["frontend"],
  customFields: {},
  extractionSource: "manual",
  fingerprint: "job:https://example.com/job:engineer",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-02T00:00:00.000Z",
  sync: {}
};

describe("computeDashboardMetrics", () => {
  it("uses events for interview and offer rates", () => {
    const events: ApplicationEvent[] = [
      { id: "e1", applicationId: "a1", type: "created", occurredAt: "2026-08-02T00:00:00.000Z" },
      {
        id: "e2",
        applicationId: "a1",
        type: "status_changed",
        fromStatus: "saved",
        toStatus: "interview",
        occurredAt: "2026-08-03T00:00:00.000Z"
      }
    ];
    const metrics = computeDashboardMetrics([baseApp], events, {
      now: new Date("2026-08-03T12:00:00.000Z")
    });
    expect(metrics.interviewRate).toBe(100);
    expect(metrics.offerRate).toBe(0);
    expect(metrics.averageResponseDays).toBe(2);
    expect(metrics.addedThisWeek).toBe(1);
  });

  it("counts deadlines within the local calendar week, including the start-of-week dates", () => {
    const now = new Date(2026, 7, 10, 12, 0, 0);
    const matches = [
      { ...baseApp, id: "a2", deadline: new Date(2026, 7, 9, 12, 0, 0).toISOString() },
      { ...baseApp, id: "a3", deadline: new Date(2026, 7, 10, 12, 0, 0).toISOString() },
      { ...baseApp, id: "a4", deadline: new Date(2026, 7, 17, 12, 0, 0).toISOString() }
    ];

    expect(dueTodayOrThisWeek(matches, now).map((item) => item.id)).toEqual(["a2", "a3"]);
  });
});
