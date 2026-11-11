import "server-only";
import { query } from "@/lib/db";

export type ProductRow = {
  id: number;
  name: string;
  description: string;
  category: string;
  price: string;
  image_url: string | null;
  rating: string | null;
  cost_price: string | null;
  supplier_id: string | null;
  internal_notes: string | null;
  stock_location: string | null;
  quantity: number;
  updated_at: string;
};

export async function getProduct(id: number): Promise<ProductRow | null> {
  const [row] = await query<ProductRow>(
    "select * from products where id = $1",
    [id],
  );
  return row ?? null;
}

// The catalogue the home page lists while search is not connected: what the
// connector's transformation (demo/transform.js) would index, and nothing of
// the database-only fields.
export type CatalogueRow = Pick<
  ProductRow,
  "id" | "name" | "description" | "category" | "price" | "image_url" | "rating" | "quantity"
>;

export async function listProducts(): Promise<CatalogueRow[]> {
  return query<CatalogueRow>(
    "select id, name, description, category, price, image_url, rating, quantity from products order by id",
  );
}
