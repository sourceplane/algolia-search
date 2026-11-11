// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SearchExperience } from "@/components/search/search-experience";
import { fakeAlgolia, type Indexed } from "./support/fake-algolia";

// components/search/search-experience.tsx, the template's InstantSearch UI,
// rendered for real against a local stand-in for Algolia's search API. The
// application id, the search-only key and the host arrive as props (the page
// reads them from the Worker per request); the component builds its lite
// client from them and nothing else.
const records: Indexed[] = [
  { objectID: "1", name: "Aurora Wireless Headphones", description: "Over-ear noise-cancelling headphones.", category: "Audio", price: 199, image_url: null, rating: 3.7, quantity: 120, in_stock: true },
  { objectID: "2", name: "Pulse True Wireless Earbuds", description: "Compact in-ear earbuds.", category: "Audio", price: 129.99, image_url: null, rating: 1.2, quantity: 0, in_stock: false },
  { objectID: "3", name: "Summit Trail Backpack", description: "A 28-litre daypack.", category: "Outdoor", price: 89, image_url: null, rating: 4.4, quantity: 40, in_stock: true },
  { objectID: "4", name: "Ember Pour-Over Kettle", description: "A gooseneck kettle.", category: "Kitchen", price: 59.5, image_url: null, rating: 4.8, quantity: 12, in_stock: true },
];
let stand: Awaited<ReturnType<typeof fakeAlgolia>>;

beforeAll(async () => {
  stand = await fakeAlgolia(records);
});
afterAll(async () => {
  await stand.close();
});
afterEach(() => {
  cleanup();
  stand.seen.length = 0;
});

function connected() {
  return render(<SearchExperience config={{ appId: "TESTAPP", searchApiKey: "search-only-key", host: stand.url }} />);
}
const links = () => Array.from(document.querySelectorAll('a[href^="/products/"]')).map((a) => a.getAttribute("href"));

describe("SearchExperience, connected", () => {
  it("searches the products index with the application id and search-only key it was handed", async () => {
    connected();
    expect(await screen.findByText(/^4 results · \d+ms$/, undefined, { timeout: 5000 })).toBeTruthy();
    expect(links().sort()).toEqual(["/products/1", "/products/2", "/products/3", "/products/4"]);
    const first = stand.seen[0]!;
    expect(first.path).toBe("/1/indexes/*/queries");
    expect(first.app).toBe("TESTAPP");
    expect(first.key).toBe("search-only-key");
    expect(first.body.requests?.[0]).toMatchObject({ indexName: "products" });
  });

  it("narrows the hits as a visitor types", async () => {
    connected();
    await screen.findByText(/^4 results/, undefined, { timeout: 5000 });
    fireEvent.input(screen.getByPlaceholderText("Try “headphones”…"), { target: { value: "headphones" } });
    expect(await screen.findByText(/^1 result · \d+ms$/, undefined, { timeout: 5000 })).toBeTruthy();
    await waitFor(() => expect(links()).toEqual(["/products/1"]));
  });

  it("hides what is out of stock when asked", async () => {
    connected();
    await screen.findByText(/^4 results/, undefined, { timeout: 5000 });
    expect(screen.getAllByText("Out of stock")).toHaveLength(1);
    fireEvent.click(screen.getByLabelText("Hide out of stock"));
    expect(await screen.findByText(/^3 results/, undefined, { timeout: 5000 })).toBeTruthy();
    expect(links()).not.toContain("/products/2");
    const filters = stand.seen.at(-1)!.body.requests?.[0]?.facetFilters;
    expect(JSON.stringify(filters)).toContain("in_stock:true");
  });

  it("lists the categories as facets, with their counts", async () => {
    connected();
    const facet = () =>
      Array.from(document.querySelectorAll(".ais-RefinementList-item")).map((li) => li.textContent?.replace(/\s+/g, " ").trim());
    await waitFor(() => expect(facet()).toEqual(["Audio2", "Kitchen1", "Outdoor1"]), { timeout: 5000 });
  });
});

describe("SearchExperience, not connected", () => {
  it("says which secrets to set, and calls nobody", async () => {
    render(<SearchExperience config={null} />);
    const notice = screen.getByText(/Search activates once the/).textContent ?? "";
    expect(notice).toContain("ALGOLIA_APP_ID");
    expect(notice).toContain("ALGOLIA_SEARCH_API_KEY");
    expect(notice).toContain("redeploy");
    await new Promise((r) => setTimeout(r, 300));
    expect(stand.seen).toHaveLength(0);
  });
});
