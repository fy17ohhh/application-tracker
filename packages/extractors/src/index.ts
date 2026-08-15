import { genericDomExtractor } from "./genericDom";
import { jsonLdExtractor } from "./jsonLd";
import { ruleBasedTextExtractor } from "./ruleBasedText";
import type { ExtractionResult, PageContext, PageExtractor } from "./types";

export * from "./genericDom";
export * from "./htmlFilter";
export * from "./jsonLd";
export * from "./normalizers";
export * from "./ruleBasedText";
export * from "./types";

export const defaultExtractors: PageExtractor[] = [jsonLdExtractor, ruleBasedTextExtractor, genericDomExtractor];

export async function extractApplication(
  context: PageContext,
  extractors: PageExtractor[] = defaultExtractors
): Promise<ExtractionResult> {
  const warnings: string[] = [];
  for (const extractor of extractors) {
    if (!extractor.canHandle(context)) continue;
    const result = await extractor.extract(context);
    warnings.push(...result.warnings);
    if (result.confidence >= 0.5 || extractor.id === "generic-dom") {
      return { ...result, warnings };
    }
  }
  return {
    data: {
      type: "job",
      title: context.title || "Untitled application",
      organization: context.domain,
      status: "saved",
      sourceUrl: context.url,
      sourceDomain: context.domain,
      tags: [],
      customFields: {},
      extractionSource: "manual",
      extractionConfidence: 0
    },
    confidence: 0,
    source: "manual",
    warnings: ["No extractor matched. Please fill the form manually."],
    evidence: {}
  };
}
