import { sanitizeText } from "@application-tracker/core";

export interface RelevantPageText {
  text: string;
  lines: string[];
  evidence: string[];
}

const noisySelectors = [
  "script",
  "style",
  "noscript",
  "svg",
  "canvas",
  "iframe",
  "nav",
  "header",
  "footer",
  "aside",
  "[role='navigation']",
  "[role='banner']",
  "[role='contentinfo']",
  "[aria-hidden='true']",
  "[hidden]"
];

const candidateSelectors = [
  "main",
  "article",
  "[role='main']",
  "[class*='job' i]",
  "[class*='description' i]",
  "[class*='posting' i]",
  "[class*='details' i]",
  "[class*='content' i]",
  "[data-test*='job' i]",
  "[data-testid*='job' i]",
  "[id*='job' i]",
  "[id*='description' i]"
];

const positiveSignals = [
  "about the job",
  "job description",
  "responsibilities",
  "qualifications",
  "requirements",
  "skills",
  "salary",
  "benefits",
  "apply",
  "deadline",
  "employment type",
  "seniority level",
  "职位描述",
  "岗位职责",
  "任职要求",
  "申请要求",
  "薪资",
  "截止"
];

const negativeSignals = [
  "people also viewed",
  "similar jobs",
  "recommended jobs",
  "sign in",
  "create job alert",
  "cookie",
  "privacy",
  "terms",
  "promoted",
  "相似职位",
  "推荐职位",
  "登录",
  "隐私"
];

export function extractRelevantPageText(html: string, fallbackText: string): RelevantPageText {
  const document = new DOMParser().parseFromString(html, "text/html");
  Array.from(document.querySelectorAll(noisySelectors.join(","))).forEach((node) => node.remove());

  const blocks = Array.from(document.querySelectorAll(candidateSelectors.join(",")))
    .map((element) => ({
      selector: describeElement(element),
      text: normalizeBlockText(element.textContent ?? "")
    }))
    .filter((block) => block.text.length >= 80)
    .map((block) => ({ ...block, score: scoreBlock(block.text) }))
    .filter((block) => block.score > 0)
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length);

  const selected = dedupeBlocks(blocks).slice(0, 4);
  const text =
    selected.length > 0
      ? selected.map((block) => block.text).join("\n")
      : normalizeBlockText(fallbackText);
  const lines = normalizedLines(text);

  return {
    text,
    lines,
    evidence: selected.map((block) => `${block.selector} score=${block.score}`)
  };
}

export function normalizedLines(text: string): string[] {
  return text
    .split(/\r?\n| {2,}/)
    .map((line) => sanitizeText(line))
    .filter((line): line is string => Boolean(line))
    .filter((line, index, lines) => line !== lines[index - 1])
    .slice(0, 1400);
}

function normalizeBlockText(text: string): string {
  return text
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => sanitizeText(line))
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function scoreBlock(text: string): number {
  const lower = text.toLowerCase();
  let score = Math.min(8, Math.floor(text.length / 280));
  for (const signal of positiveSignals) {
    if (lower.includes(signal)) score += 4;
  }
  for (const signal of negativeSignals) {
    if (lower.includes(signal)) score -= 5;
  }
  if (/\b(remote|hybrid|onsite|full-time|part-time|contract)\b/i.test(text)) score += 2;
  if (/[$€£¥]\s?\d|(?:usd|eur|gbp|cny|rmb)\b/i.test(text)) score += 2;
  if (/linkedin|apply|easy apply/i.test(text)) score += 1;
  return score;
}

function dedupeBlocks<T extends { text: string }>(blocks: T[]): T[] {
  const selected: T[] = [];
  for (const block of blocks) {
    const isDuplicate = selected.some(
      (item) => item.text.includes(block.text.slice(0, 120)) || block.text.includes(item.text.slice(0, 120))
    );
    if (!isDuplicate) selected.push(block);
  }
  return selected;
}

function describeElement(element: Element): string {
  const id = element.id ? `#${element.id}` : "";
  const className =
    typeof element.className === "string"
      ? element.className
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 3)
          .map((item) => `.${item}`)
          .join("")
      : "";
  return `${element.tagName.toLowerCase()}${id}${className}`;
}
