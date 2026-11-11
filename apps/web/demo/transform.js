// Allow-list: only searchable attributes reach the index.
// DB-only fields (cost_price, supplier_id, internal_notes, stock_location) never leave Supabase.
// in_stock is DERIVED here from quantity — it is not a DB column.
// Canonical copy of the code pasted into the Algolia dashboard transformation editor.
async function transform(record, helper) {
  return {
    objectID: String(record.id),
    name: record.name,
    description: record.description,
    category: record.category,
    price: Number(record.price),
    image_url: record.image_url ?? null,
    rating: record.rating == null ? null : Number(record.rating),
    quantity: Number(record.quantity),
    in_stock: Number(record.quantity) > 0,
  };
}
