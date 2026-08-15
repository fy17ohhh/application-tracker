import * as XLSX from "xlsx";
import { applicationDraftSchema, type Application, type ApplicationDraft } from "./schemas";
import { getDomain, parseTags } from "./utils";

export const exportColumns = [
  "Type",
  "Organization",
  "Title",
  "Location",
  "Status",
  "Source URL",
  "Deadline",
  "Applied At",
  "Tags",
  "Notes",
  "Created At",
  "Updated At"
] as const;

export function applicationsToRows(applications: Application[]): Record<string, string>[] {
  return applications.map((item) => ({
    Type: item.type,
    Organization: item.organization,
    Title: item.title,
    Location: item.location ?? "",
    Status: item.status,
    "Source URL": item.sourceUrl,
    Deadline: item.deadline ?? "",
    "Applied At": item.appliedAt ?? "",
    Tags: item.tags.join("; "),
    Notes: item.notes ?? "",
    "Created At": item.createdAt,
    "Updated At": item.updatedAt
  }));
}

export function exportCsv(applications: Application[]): string {
  const rows = applicationsToRows(applications);
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return [exportColumns.join(","), ...rows.map((row) => exportColumns.map((key) => escape(row[key] ?? "")).join(","))].join(
    "\n"
  );
}

export function exportXlsx(applications: Application[]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(applicationsToRows(applications), { header: [...exportColumns] });
  XLSX.utils.book_append_sheet(workbook, sheet, "Applications");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export function createTemplateXlsx(): ArrayBuffer {
  const sheet = XLSX.utils.aoa_to_sheet([[...exportColumns]]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Applications");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

export interface ImportPreviewRow {
  rowNumber: number;
  draft?: ApplicationDraft | undefined;
  errors: string[];
}

export function rowsToDrafts(rows: Record<string, unknown>[]): ImportPreviewRow[] {
  return rows.map((row, index) => {
    const sourceUrl = String(row["Source URL"] ?? "");
    const draft = {
      type: row.Type === "degree" ? "degree" : "job",
      organization: String(row.Organization ?? ""),
      title: String(row.Title ?? ""),
      location: optionalString(row.Location),
      status: String(row.Status ?? "applied") || "applied",
      sourceUrl,
      sourceDomain: sourceUrl ? getDomain(sourceUrl) : "",
      deadline: optionalString(row.Deadline),
      appliedAt: optionalString(row["Applied At"]),
      notes: optionalString(row.Notes),
      tags: parseTags(String(row.Tags ?? "")),
      customFields: {},
      extractionSource: "manual" as const
    };
    const parsed = applicationDraftSchema.safeParse(draft);
    return {
      rowNumber: index + 2,
      draft: parsed.success ? parsed.data : undefined,
      errors: parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    };
  });
}

export function parseCsv(csv: string): Record<string, string>[] {
  const [headerLine, ...lines] = csv.split(/\r?\n/).filter(Boolean);
  if (!headerLine) return [];
  const headers = parseCsvLine(headerLine);
  return lines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

export function parseXlsx(buffer: ArrayBuffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer);
  const firstSheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!firstSheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet);
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function optionalString(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : undefined;
}
