import { getDomain, sanitizeText } from "@application-tracker/core";
import type { PageExtractor } from "./types";
import { extractRelevantPageText, normalizedLines } from "./htmlFilter";
import { date } from "./normalizers";

const stopSections = [
  "about the company",
  "company overview",
  "similar jobs",
  "people also viewed",
  "set alert",
  "show more",
  "show less",
  "申请人",
  "相似职位",
  "关于公司"
];

export const ruleBasedTextExtractor: PageExtractor = {
  id: "rule-based-text",
  canHandle(context) {
    return normalizedLines(context.text).length >= 4 || context.html.length > 200;
  },
  async extract(context) {
    const relevant = extractRelevantPageText(context.html, context.text);
    const lines = relevant.lines.length >= 4 ? relevant.lines : normalizedLines(context.text);
    const focusedText = relevant.text || context.text;
    const parsedTitle = parseTitle(context.title, context.domain);
    const linkedIn = /(^|\.)linkedin\.com$/i.test(context.domain);
    const document = new DOMParser().parseFromString(context.html, "text/html");
    const title = pick(
      parsedTitle.title,
      queryText(document, [
        "h1",
        "[class*='job-title' i]",
        "[class*='top-card-layout__title' i]",
        "[class*='title' i]"
      ]),
      findLineAfter(lines, ["job title", "position", "职位"]),
      firstLikelyTitle(lines),
      context.title,
      "Untitled application"
    );
    const organization = pick(
      parsedTitle.organization,
      queryText(document, [
        "[class*='company-name' i]",
        "[class*='topcard__org-name' i]",
        "[class*='sub-nav-cta__optional-url' i]",
        "[class*='school' i]"
      ]),
      findOrganizationNearTitle(lines, title),
      findLineAfter(lines, ["company", "organization", "school", "公司", "学校"]),
      context.domain
    );
    const location = pick(
      parsedTitle.location,
      findLineAfter(lines, ["location", "地点", "工作地点"]),
      findLocationNearTitle(lines, title, organization)
    );
    const description = extractSection(lines, ["about the job", "job description", "description", "职位描述", "岗位职责"]);
    const requirements = extractSection(lines, ["requirements", "qualifications", "minimum qualifications", "任职要求", "申请要求"])
      ?.split(/[.;。；\n]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 8)
      .slice(0, 12);
    const deadlineText = findDeadline(focusedText);
    const inferredType = /degree|program|tuition|scholarship|university|college|学位|项目|奖学金/i.test(focusedText)
      ? "degree"
      : "job";
    const confidence = score({ title, organization, location, description, deadlineText, linkedIn });

    return {
      data: {
        type: inferredType,
        title,
        organization,
        location,
        status: "saved",
        sourceUrl: context.url,
        sourceDomain: getDomain(context.url),
        description,
        requirements,
        deadline: date(deadlineText),
        tags: linkedIn ? ["linkedin"] : [],
        customFields: {},
        extractionConfidence: confidence,
        extractionSource: "generic-dom"
      },
      confidence,
      source: "generic-dom",
      warnings: confidence < 0.7 ? ["Rule-based text extraction needs review before saving."] : [],
      evidence: {
        title: parsedTitle.title ? "document.title pattern" : "page text likely title",
        organization: parsedTitle.organization ? "document.title pattern" : "nearby page text",
        location: location ? "document.title or page text" : "not found",
        description: description ? "filtered relevant HTML text section" : "not found",
        filteredHtmlBlocks: relevant.evidence.join("; ") || "fallback full text",
        deadline: deadlineText ?? "not found"
      }
    };
  }
};

function parseTitle(title: string, domain: string): {
  title?: string | undefined;
  organization?: string | undefined;
  location?: string | undefined;
} {
  const clean = sanitizeText(title)?.replace(/\s+\|\s+LinkedIn.*$/i, "") ?? "";
  const linkedInHiring = clean.match(/^(.+?)\s+hiring\s+(.+?)\s+in\s+(.+)$/i);
  if (linkedInHiring) {
    return {
      organization: linkedInHiring[1],
      title: linkedInHiring[2],
      location: linkedInHiring[3]
    };
  }
  const linkedInJob = clean.match(/^(.+?)\s+at\s+(.+?)(?:\s+in\s+(.+))?$/i);
  if (linkedInJob) {
    return {
      title: linkedInJob[1],
      organization: linkedInJob[2],
      location: linkedInJob[3]
    };
  }
  if (domain.includes("linkedin.com")) {
    const parts = clean.split(/\s*[-|]\s*/).filter(Boolean);
    return { title: parts[0], organization: parts[1] };
  }
  return {};
}

function firstLikelyTitle(lines: string[]): string | undefined {
  return lines.find(
    (line) =>
      line.length >= 8 &&
      line.length <= 90 &&
      !/^(home|jobs|search|sign in|apply|save|share|profile|notifications|messaging)$/i.test(line)
  );
}

function queryText(document: Document, selectors: string[]): string | undefined {
  for (const selector of selectors) {
    const value = sanitizeText(document.querySelector(selector)?.textContent);
    if (value && value.length <= 120) return value;
  }
  return undefined;
}

function findOrganizationNearTitle(lines: string[], title: string): string | undefined {
  const index = lines.findIndex((line) => sameText(line, title));
  if (index < 0) return undefined;
  return lines.slice(index + 1, index + 5).find((line) => line.length <= 90 && !looksLikeLocation(line));
}

function findLocationNearTitle(lines: string[], title: string, organization: string): string | undefined {
  const index = lines.findIndex((line) => sameText(line, title));
  if (index < 0) return undefined;
  return lines
    .slice(index + 1, index + 8)
    .filter((line) => !sameText(line, organization))
    .find(looksLikeLocation);
}

function findLineAfter(lines: string[], labels: string[]): string | undefined {
  const lowerLabels = labels.map((label) => label.toLowerCase());
  const index = lines.findIndex((line) => lowerLabels.includes(line.toLowerCase().replace(/[:：]$/, "")));
  return index >= 0 ? lines[index + 1] : undefined;
}

function extractSection(lines: string[], headings: string[]): string | undefined {
  const lowerHeadings = headings.map((heading) => heading.toLowerCase());
  const start = lines.findIndex((line) => lowerHeadings.includes(line.toLowerCase().replace(/[:：]$/, "")));
  if (start < 0) return undefined;
  const collected: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const lower = line.toLowerCase();
    if (stopSections.some((section) => lower.includes(section)) || isLikelyHeading(line, collected.length)) break;
    collected.push(line);
    if (collected.join(" ").length > 1800) break;
  }
  return sanitizeText(collected.join("\n"));
}

function findDeadline(text: string): string | undefined {
  const match = text.match(
    /(deadline|apply by|closing date|applications close|截止|申请截止)[^\n:.：]{0,24}[:：]?\s*([A-Za-z]+\s+\d{1,2},?\s+\d{4}|\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/i
  );
  return match?.[2];
}

function looksLikeLocation(line: string): boolean {
  return /remote|hybrid|onsite|united states|china|singapore|canada|london|new york|san francisco|北京|上海|深圳|广州|远程/i.test(line);
}

function isLikelyHeading(line: string, collectedCount: number): boolean {
  return collectedCount > 0 && line.length < 48 && /^[A-Z][A-Za-z\s/&-]+$/.test(line);
}

function sameText(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

function pick(...values: Array<string | undefined>): string {
  return values.map(sanitizeText).find(Boolean) ?? "";
}

function score(input: {
  title: string;
  organization: string;
  location?: string | undefined;
  description?: string | undefined;
  deadlineText?: string | undefined;
  linkedIn: boolean;
}): number {
  let value = input.linkedIn ? 0.54 : 0.42;
  if (input.title) value += 0.12;
  if (input.organization) value += 0.12;
  if (input.location) value += 0.06;
  if (input.description) value += 0.08;
  if (input.deadlineText) value += 0.06;
  return Math.min(0.82, Math.round(value * 100) / 100);
}
