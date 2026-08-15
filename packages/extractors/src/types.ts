import type { ApplicationDraft } from "@application-tracker/core";

export interface PageContext {
  url: string;
  title: string;
  html: string;
  text: string;
  domain: string;
}

export type Evidence = Record<string, string>;

export interface ExtractionResult {
  data: Partial<ApplicationDraft>;
  confidence: number;
  source: ApplicationDraft["extractionSource"];
  warnings: string[];
  evidence: Evidence;
}

export interface PageExtractor {
  id: string;
  canHandle(context: PageContext): boolean;
  extract(context: PageContext): Promise<ExtractionResult>;
}
