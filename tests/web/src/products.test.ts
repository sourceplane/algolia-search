import { describe, expect, it, vi } from "vitest";

// lib/products.ts: the product page's one query is upstream's; the catalogue's
// is new, and reads only what the connector's transformation would index.
const sent: [string, unknown[] | undefined][] = [];
vi.mock("@/lib/db", () => ({
  query: async (text: string, params?: unknown[]) => {
    sent.push([text, params]);
    return text.includes("where id") ? [{ id: params?.[0], name: "x" }] : [];
  },
}));
vi.mock("server-only", () => ({}));

describe("lib/products.ts", () => {
  it("reads one product by id, as upstream did", async () => {
    const { getProduct } = await import("@/lib/products");
    expect(await getProduct(3)).toEqual({ id: 3, name: "x" });
    expect(sent.at(-1)).toEqual(["select * from products where id = $1", [3]]);
  });

  it("lists the catalogue in id order without a single database-only field", async () => {
    const { listProducts } = await import("@/lib/products");
    await listProducts();
    const [text] = sent.at(-1)!;
    expect(text).toMatch(/from products order by id$/);
    for (const internal of ["cost_price", "supplier_id", "internal_notes", "stock_location", "*"]) {
      expect(text).not.toContain(internal);
    }
    for (const field of ["id", "name", "description", "category", "price", "image_url", "rating", "quantity"]) {
      expect(text).toContain(field);
    }
  });
});
