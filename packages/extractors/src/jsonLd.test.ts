import { describe, expect, it } from "vitest";
import { extractApplication } from "./index";

describe("jsonLdExtractor", () => {
  it("extracts a JobPosting schema", async () => {
    const html = `<!doctype html><html><head><title>Senior Engineer</title><script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Senior TypeScript Engineer",
        "description": "Build extension architecture.",
        "validThrough": "2026-09-01",
        "hiringOrganization": { "@type": "Organization", "name": "Acme" },
        "jobLocation": { "@type": "Place", "address": "Remote" }
      }
    </script></head><body></body></html>`;

    const result = await extractApplication({
      url: "https://jobs.example.com/role?x=1",
      title: "Senior Engineer",
      html,
      text: "Senior Engineer",
      domain: "jobs.example.com"
    });

    expect(result.source).toBe("json-ld");
    expect(result.data.organization).toBe("Acme");
    expect(result.data.title).toBe("Senior TypeScript Engineer");
    expect(result.data.location).toBe("Remote");
    expect(result.data.deadline).toContain("2026-09-01");
  });
});
