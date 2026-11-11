import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// app/page.tsx: the template's page, with the search config read per request
// and the catalogue listed while search is not connected.
type Config = { appId: string; searchApiKey: string } | null;

async function render(config: Config) {
  vi.resetModules();
  const props: unknown[] = [];
  vi.doMock("@/lib/algolia", () => ({ searchConfig: () => config }));
  vi.doMock("@/components/search/search-experience", () => ({
    SearchExperience: (p: { config: Config }) => {
      props.push(p.config);
      return <div data-testid="search">{p.config ? "instantsearch" : "notice"}</div>;
    },
  }));
  vi.doMock("@/components/catalogue", () => ({ Catalogue: () => <div data-testid="catalogue" /> }));
  const { default: Home, dynamic } = await import("@/app/page");
  return { html: renderToStaticMarkup(<Home />).replaceAll("<!-- -->", ""), props, dynamic };
}

describe("Home (app/page.tsx)", () => {
  it("renders per request: the Algolia secrets are read at render, never frozen in at build", async () => {
    expect((await render(null)).dynamic).toBe("force-dynamic");
  });

  it("without Algolia: the notice and the catalogue, marked not-connected", async () => {
    const { html, props } = await render(null);
    expect(html).toContain('data-search="not-connected"');
    expect(html).toContain("notice");
    expect(html).toContain('data-testid="catalogue"');
    expect(props).toEqual([null]);
  });

  it("with Algolia: InstantSearch handed the Worker's config, and no catalogue", async () => {
    const config = { appId: "APP", searchApiKey: "search-key" };
    const { html, props } = await render(config);
    expect(html).toContain('data-search="connected"');
    expect(html).toContain("instantsearch");
    expect(html).not.toContain('data-testid="catalogue"');
    expect(props).toEqual([config]);
  });

  it("keeps the template's words, with Cloudflare where Vercel was", async () => {
    const { html } = await render(null);
    expect(html).toContain("finds it.");
    expect(html).toContain("Cloudflare</span> wires them.");
    expect(html).toContain("deployed on Cloudflare.");
    expect(html).toContain("Open-source search starter");
    expect(html.toLowerCase()).not.toContain("vercel");
  });
});
