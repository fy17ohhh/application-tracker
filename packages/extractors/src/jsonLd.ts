import { getDomain } from "@application-tracker/core";
import type { ExtractionResult, PageContext, PageExtractor } from "./types";
import { currency, date, numberFrom, text } from "./normalizers";

type JsonObject = Record<string, unknown>;

export const jsonLdExtractor: PageExtractor = {
  id: "schema-org-json-ld",
  canHandle(context) {
    return context.html.includes("application/ld+json");
  },
  async extract(context) {
    const nodes = parseJsonLd(context.html);
    const job = nodes.find((node) => hasType(node, "JobPosting"));
    if (job) return extractJob(job, context);
    const program = nodes.find(
      (node) => hasType(node, "EducationalOccupationalProgram") || hasType(node, "Course")
    );
    if (program) return extractProgram(program, context);
    const organization = nodes.find((node) => hasType(node, "Organization"));
    return fallbackResult(context, organization);
  }
};

function extractJob(node: JsonObject, context: PageContext): ExtractionResult {
  const hiringOrganization = node.hiringOrganization as JsonObject | undefined;
  const baseSalary = node.baseSalary as JsonObject | undefined;
  const value = baseSalary?.value as JsonObject | undefined;
  const title = text(node.title) ?? context.title;
  const organization = text(hiringOrganization) ?? text(node.organization) ?? context.domain;
  const location = text(node.jobLocation) ?? text((node.jobLocation as JsonObject | undefined)?.address);
  return {
    data: {
      type: "job",
      title,
      organization,
      location,
      status: "saved",
      sourceUrl: context.url,
      sourceDomain: getDomain(context.url),
      description: text(node.description),
      requirements: splitRequirements(text(node.qualifications) ?? text(node.responsibilities)),
      salary: baseSalary
        ? {
            min: numberFrom(value?.minValue ?? value?.value ?? baseSalary),
            max: numberFrom(value?.maxValue),
            currency: currency(baseSalary.currency ?? node.salaryCurrency),
            period: text(value?.unitText)
          }
        : undefined,
      deadline: date(node.validThrough),
      tags: [],
      customFields: {},
      extractionConfidence: 0.92,
      extractionSource: "json-ld"
    },
    confidence: 0.92,
    source: "json-ld",
    warnings: [],
    evidence: {
      title: "JSON-LD JobPosting.title",
      organization: "JSON-LD JobPosting.hiringOrganization",
      deadline: "JSON-LD JobPosting.validThrough"
    }
  };
}

function extractProgram(node: JsonObject, context: PageContext): ExtractionResult {
  const provider = node.provider as JsonObject | undefined;
  const offers = Array.isArray(node.offers) ? (node.offers[0] as JsonObject | undefined) : (node.offers as JsonObject | undefined);
  return {
    data: {
      type: "degree",
      title: text(node.name) ?? context.title,
      organization: text(provider) ?? text(node.sourceOrganization) ?? context.domain,
      location: text(node.educationalProgramMode),
      status: "saved",
      sourceUrl: context.url,
      sourceDomain: getDomain(context.url),
      description: text(node.description),
      tuition: offers
        ? {
            amount: numberFrom(offers.price),
            currency: currency(offers.priceCurrency),
            period: text(offers.priceSpecification)
          }
        : undefined,
      deadline: date(node.applicationDeadline ?? node.endDate),
      tags: [],
      customFields: {},
      extractionConfidence: 0.88,
      extractionSource: "json-ld"
    },
    confidence: 0.88,
    source: "json-ld",
    warnings: [],
    evidence: {
      title: "JSON-LD program.name",
      organization: "JSON-LD provider",
      deadline: "JSON-LD applicationDeadline/endDate"
    }
  };
}

function fallbackResult(context: PageContext, organization?: JsonObject): ExtractionResult {
  return {
    data: {
      type: "job",
      title: context.title || "Untitled application",
      organization: text(organization) ?? context.domain,
      status: "saved",
      sourceUrl: context.url,
      sourceDomain: getDomain(context.url),
      tags: [],
      customFields: {},
      extractionConfidence: 0.35,
      extractionSource: "json-ld"
    },
    confidence: 0.35,
    source: "json-ld",
    warnings: ["Found JSON-LD, but no JobPosting or education program schema was present."],
    evidence: { title: "document.title" }
  };
}

function parseJsonLd(html: string): JsonObject[] {
  const document = new DOMParser().parseFromString(html, "text/html");
  const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  return scripts.flatMap((script) => flattenJson(readJson(script.textContent ?? "")));
}

function readJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function flattenJson(value: unknown): JsonObject[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(flattenJson);
  if (typeof value !== "object") return [];
  const object = value as JsonObject;
  const graph = object["@graph"];
  return [object, ...(Array.isArray(graph) ? graph.flatMap(flattenJson) : [])];
}

function hasType(node: JsonObject, expected: string): boolean {
  const type = node["@type"];
  return Array.isArray(type) ? type.includes(expected) : type === expected;
}

function splitRequirements(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .replace(/<[^>]+>/g, " ")
    .split(/[.;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return parts.length ? parts.slice(0, 12) : undefined;
}
