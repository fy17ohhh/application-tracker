import { getDomain, sanitizeText } from "@application-tracker/core";
import type { PageExtractor } from "./types";
import { date, meta } from "./normalizers";

export const genericDomExtractor: PageExtractor = {
  id: "generic-dom",
  canHandle() {
    return true;
  },
  async extract(context) {
    const document = new DOMParser().parseFromString(context.html, "text/html");
    const title = pick(
      meta(context.html, "og:title"),
      document.querySelector("h1")?.textContent,
      context.title,
      "Untitled application"
    );
    const description = pick(
      meta(context.html, "description"),
      meta(context.html, "og:description"),
      document.querySelector('[class*="description" i]')?.textContent
    );
    const organization = pick(
      meta(context.html, "og:site_name"),
      document.querySelector('[class*="company" i], [class*="school" i], [class*="organization" i]')?.textContent,
      context.domain
    );
    const deadlineText = findDeadline(context.text);
    const inferredType = /degree|program|tuition|scholarship|university|college|学位|项目|奖学金/i.test(context.text)
      ? "degree"
      : "job";
    const warnings = ["Generic DOM extraction may be incomplete. Please review fields before saving."];
    return {
      data: {
        type: inferredType,
        title,
        organization,
        status: "saved",
        sourceUrl: context.url,
        sourceDomain: getDomain(context.url),
        description,
        deadline: date(deadlineText),
        tags: [],
        customFields: {},
        extractionConfidence: deadlineText ? 0.55 : 0.45,
        extractionSource: "generic-dom"
      },
      confidence: deadlineText ? 0.55 : 0.45,
      source: "generic-dom",
      warnings,
      evidence: {
        title: "og:title, h1, or document.title",
        organization: "og:site_name or company/school selector",
        deadline: deadlineText ?? "not found"
      }
    };
  }
};

function pick(...values: Array<string | null | undefined>): string {
  return values.map(sanitizeText).find(Boolean) ?? "";
}

function findDeadline(text: string): string | undefined {
  const match = text.match(
    /(deadline|apply by|closing date|截止|申请截止|deadline date)[^\n:.：]{0,20}[:：]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i
  );
  return match?.[2];
}
