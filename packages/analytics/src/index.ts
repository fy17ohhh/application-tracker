import type { Application, ApplicationEvent, ApplicationType } from "@application-tracker/core";

export interface AnalyticsFilter {
  type?: ApplicationType;
  now?: Date;
}

export interface DashboardMetrics {
  total: number;
  addedThisWeek: number;
  addedThisMonth: number;
  active: number;
  interviewRate: number;
  offerRate: number;
  averageResponseDays: number | null;
  statusFunnel: Array<{ status: string; count: number }>;
  trend: Array<{ period: string; count: number }>;
  byOrganization: Array<{ key: string; count: number }>;
  bySourceDomain: Array<{ key: string; count: number }>;
  byLocation: Array<{ key: string; count: number }>;
  byTag: Array<{ key: string; count: number }>;
}

const terminalStatuses = new Set(["rejected", "withdrawn", "offer", "accepted", "录取", "拒绝", "已撤回"]);
const interviewStatuses = new Set(["interview", "interviewing", "面试"]);
const offerStatuses = new Set(["offer", "accepted", "录取"]);

export function computeDashboardMetrics(
  applications: Application[],
  events: ApplicationEvent[],
  filter: AnalyticsFilter = {}
): DashboardMetrics {
  const now = filter.now ?? new Date();
  const scoped = filter.type ? applications.filter((item) => item.type === filter.type) : applications;
  const scopedIds = new Set(scoped.map((item) => item.id));
  const scopedEvents = events.filter((event) => scopedIds.has(event.applicationId));
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const createdEvents = scopedEvents.filter((event) => event.type === "created");
  const interviewIds = idsWithStatus(scopedEvents, interviewStatuses);
  const offerIds = idsWithStatus(scopedEvents, offerStatuses);

  return {
    total: scoped.length,
    addedThisWeek: createdEvents.filter((event) => new Date(event.occurredAt) >= weekStart).length,
    addedThisMonth: createdEvents.filter((event) => new Date(event.occurredAt) >= monthStart).length,
    active: scoped.filter((item) => !terminalStatuses.has(item.status.toLowerCase())).length,
    interviewRate: rate(interviewIds.size, scoped.length),
    offerRate: rate(offerIds.size, scoped.length),
    averageResponseDays: averageResponseDays(scoped, scopedEvents),
    statusFunnel: countBy(scoped.map((item) => item.status)).map(({ key, count }) => ({ status: key, count })),
    trend: trendByWeek(createdEvents),
    byOrganization: countBy(scoped.map((item) => item.organization)),
    bySourceDomain: countBy(scoped.map((item) => item.sourceDomain)),
    byLocation: countBy(scoped.map((item) => item.location ?? "Unknown")),
    byTag: countBy(scoped.flatMap((item) => item.tags))
  };
}

export function dueTodayOrThisWeek(applications: Application[], now = new Date()): Application[] {
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  return applications.filter((item) => {
    const next = item.nextActionAt ?? item.deadline;
    if (!next) return false;
    const date = new Date(next);
    return date >= startOfDay(now) && date <= end;
  });
}

export function staleApplications(applications: Application[], now = new Date(), days = 21): Application[] {
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() - days);
  return applications.filter(
    (item) => !terminalStatuses.has(item.status.toLowerCase()) && new Date(item.updatedAt) < threshold
  );
}

function idsWithStatus(events: ApplicationEvent[], statuses: Set<string>): Set<string> {
  return new Set(
    events
      .filter((event) => event.type === "status_changed" && event.toStatus && statuses.has(event.toStatus.toLowerCase()))
      .map((event) => event.applicationId)
  );
}

function averageResponseDays(applications: Application[], events: ApplicationEvent[]): number | null {
  const createdAt = new Map(applications.map((item) => [item.id, new Date(item.createdAt)]));
  const responseEvents = events.filter((event) => event.type === "status_changed" && event.toStatus !== "saved");
  const firstByApp = new Map<string, Date>();
  for (const event of responseEvents) {
    const current = firstByApp.get(event.applicationId);
    const occurred = new Date(event.occurredAt);
    if (!current || occurred < current) firstByApp.set(event.applicationId, occurred);
  }
  const days = Array.from(firstByApp.entries()).flatMap(([id, response]) => {
    const created = createdAt.get(id);
    if (!created) return [];
    return [(response.getTime() - created.getTime()) / 86400000];
  });
  if (days.length === 0) return null;
  return Math.round((days.reduce((sum, value) => sum + value, 0) / days.length) * 10) / 10;
}

function countBy(values: string[]): Array<{ key: string; count: number }> {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const key = raw.trim() || "Unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function trendByWeek(events: ApplicationEvent[]): Array<{ period: string; count: number }> {
  return countBy(events.map((event) => weekKey(new Date(event.occurredAt)))).map(({ key, count }) => ({ period: key, count }));
}

function rate(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

function startOfWeek(date: Date): Date {
  const result = startOfDay(date);
  const day = result.getDay();
  result.setDate(result.getDate() - day);
  return result;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function weekKey(date: Date): string {
  const start = startOfWeek(date);
  return start.toISOString().slice(0, 10);
}
