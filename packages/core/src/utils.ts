import { nanoid } from "nanoid";
import type { Application, ApplicationDraft } from "./schemas";

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeUrl(input: string): string {
  const url = new URL(input);
  url.hash = "";
  return url.toString();
}

export function getDomain(input: string): string {
  return new URL(input).hostname.replace(/^www\./, "");
}

export function sanitizeText(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const cleaned = input.replace(/\s+/g, " ").replace(/[<>]/g, "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

export function normalizeDate(input: unknown): string | undefined {
  if (typeof input !== "string" || input.trim().length === 0) return undefined;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function createFingerprint(
  input: Pick<ApplicationDraft, "sourceUrl" | "type" | "title">
): string {
  const normalized = normalizeUrl(input.sourceUrl).toLowerCase();
  return `${input.type}:${normalized}:${input.title.trim().toLowerCase()}`;
}

export function createApplication(draft: ApplicationDraft): Application {
  const timestamp = nowIso();
  const normalizedUrl = normalizeUrl(draft.sourceUrl);
  return {
    ...draft,
    id: nanoid(),
    sourceUrl: normalizedUrl,
    sourceDomain: draft.sourceDomain || getDomain(normalizedUrl),
    fingerprint: createFingerprint({ ...draft, sourceUrl: normalizedUrl }),
    createdAt: timestamp,
    updatedAt: timestamp,
    sync: {
      excel: { status: "idle" }
    }
  };
}

export function parseTags(input: string | string[] | undefined): string[] {
  if (Array.isArray(input)) return input.map((tag) => tag.trim()).filter(Boolean);
  if (!input) return [];
  return input
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}
