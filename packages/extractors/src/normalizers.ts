import { getDomain, normalizeDate, sanitizeText } from "@application-tracker/core";

export function createPageContext(document: Document, url = location.href): import("./types").PageContext {
  return {
    url,
    title: sanitizeText(document.title) ?? "",
    html: document.documentElement.outerHTML,
    text: sanitizeText(document.body.innerText) ?? "",
    domain: getDomain(url)
  };
}

export function text(value: unknown): string | undefined {
  if (Array.isArray(value)) return sanitizeText(value.map((item) => text(item)).filter(Boolean).join(", "));
  if (typeof value === "object" && value !== null && "name" in value) {
    return sanitizeText((value as { name?: unknown }).name);
  }
  return sanitizeText(value);
}

export function date(value: unknown): string | undefined {
  return normalizeDate(text(value));
}

export function currency(value: unknown): string | undefined {
  const raw = text(value);
  return raw?.match(/[A-Z]{3}/)?.[0] ?? raw?.match(/[$€£¥]/)?.[0];
}

export function numberFrom(value: unknown): number | undefined {
  const raw = text(value)?.replace(/,/g, "");
  const match = raw?.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

export function meta(html: string, property: string): string | undefined {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  return (
    document.querySelector(`meta[property="${property}"]`)?.getAttribute("content") ??
    document.querySelector(`meta[name="${property}"]`)?.getAttribute("content") ??
    undefined
  );
}

export function evidence(selector: string, value: string | undefined): string | undefined {
  return value ? `${selector}: ${value}` : undefined;
}
