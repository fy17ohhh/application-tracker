import { describe, expect, it } from "vitest";
import { extractApplication } from "./index";

describe("ruleBasedTextExtractor", () => {
  it("extracts LinkedIn-like job pages from full page text", async () => {
    const html = `<!doctype html><html><head><title>OpenAI hiring Product Engineer in San Francisco, CA | LinkedIn</title></head>
    <body><main><h1>Product Engineer</h1></main></body></html>`;
    const text = [
      "Jobs",
      "Product Engineer",
      "OpenAI",
      "San Francisco, CA Hybrid",
      "About the job",
      "Build reliable user-facing systems for application workflows.",
      "Requirements",
      "Experience with TypeScript and browser extension architecture.",
      "Apply by September 1, 2026"
    ].join("\n");

    const result = await extractApplication({
      url: "https://www.linkedin.com/jobs/view/123",
      title: "OpenAI hiring Product Engineer in San Francisco, CA | LinkedIn",
      html,
      text,
      domain: "linkedin.com"
    });

    expect(result.source).toBe("generic-dom");
    expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result.data.title).toBe("Product Engineer");
    expect(result.data.organization).toBe("OpenAI");
    expect(result.data.location).toBe("San Francisco, CA");
    expect(result.data.description).toContain("Build reliable");
    expect(result.data.requirements?.[0]).toContain("TypeScript");
    expect(result.data.tags).toContain("linkedin");
  });

  it("filters noisy HTML before extracting job details", async () => {
    const html = `<!doctype html><html><head>
      <title>Stripe hiring Browser Extension Engineer in New York, NY | LinkedIn</title>
    </head><body>
      <nav>Home Jobs Messaging Notifications Sign in Similar jobs Product Manager Sales Lead</nav>
      <aside>People also viewed Create job alert Privacy Terms Promoted jobs</aside>
      <main class="jobs-search__job-details">
        <section class="job-details-jobs-unified-top-card__container">
          <h1 class="top-card-layout__title">Browser Extension Engineer</h1>
          <a class="topcard__org-name-link">Stripe</a>
          <span>New York, NY Hybrid</span>
        </section>
        <section class="jobs-description">
          <h2>About the job</h2>
          <p>Own Chrome extension architecture, TypeScript data flows, and application tracking experiences.</p>
          <h2>Requirements</h2>
          <p>Experience building Manifest V3 browser extensions and resilient IndexedDB storage.</p>
        </section>
      </main>
    </body></html>`;

    const result = await extractApplication({
      url: "https://www.linkedin.com/jobs/view/456",
      title: "Stripe hiring Browser Extension Engineer in New York, NY | LinkedIn",
      html,
      text: new DOMParser().parseFromString(html, "text/html").body.textContent ?? "",
      domain: "linkedin.com"
    });

    expect(result.data.title).toBe("Browser Extension Engineer");
    expect(result.data.organization).toBe("Stripe");
    expect(result.data.location).toBe("New York, NY");
    expect(result.data.description).toContain("Chrome extension architecture");
    expect(result.evidence.filteredHtmlBlocks).toContain("main");
  });
});
