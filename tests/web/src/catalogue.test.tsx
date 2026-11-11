import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// components/catalogue.tsx: the home page's list while search is not
// connected — the catalogue read from Postgres, in the hits' own cards.
const rows = [
  { id: 1, name: "Aurora Wireless Headphones", description: "Over-ear", category: "Audio", price: "199.00", image_url: "https://images.example/a.jpg", rating: "3.7", quantity: 120 },
  { id: 2, name: "Pulse Earbuds", description: "In-ear", category: "Audio", price: "129.99", image_url: null, rating: null, quantity: 0 },
];

async function render(result: unknown[] | Error) {
  vi.resetModules();
  vi.doMock("@/lib/products", () => ({
    listProducts: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
  }));
  const { Catalogue } = await import("@/components/catalogue");
  return renderToStaticMarkup(await Catalogue()).replaceAll("<!-- -->", "");
}

describe("Catalogue (components/catalogue.tsx)", () => {
  it("lists every product as a card that opens its product page", async () => {
    const html = await render(rows);
    expect(html).toContain("2 products · read from");
    expect(html).toContain('href="/products/1"');
    expect(html).toContain('href="/products/2"');
    expect(html).toContain("Aurora Wireless Headphones");
    expect(html).toContain("$199.00");
    expect(html).toContain("$129.99");
    expect(html).toContain("3.7");
  });

  it("marks a product with no stock, as a hit does", async () => {
    const html = await render(rows);
    expect(html.match(/Out of stock/g)).toHaveLength(1);
  });

  it("says one product, not one products", async () => {
    expect(await render([rows[0]])).toContain("1 product · read from");
  });

  it("says the migrations have not run instead of failing when the table is missing", async () => {
    const html = await render(new Error('relation "products" does not exist'));
    expect(html).toContain('data-schema="missing"');
    expect(html).toContain("db:migrate");
    expect(html).not.toContain("/products/");
  });

  it("lets any other database error through", async () => {
    await expect(render(new Error("connection refused"))).rejects.toThrow("connection refused");
  });
});
