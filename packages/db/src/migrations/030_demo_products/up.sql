-- The template's demo dataset: upstream's demo/seed.sql's twenty products,
-- byte for byte (tests/db holds this file to it). Each row is an upsert on its
-- id (`on conflict (id) do update`), so applying this again rewrites the same
-- twenty rows and never duplicates one; db-migrate applies it once per
-- environment, before the Worker serves. The four internal-only fields —
-- cost_price, supplier_id, internal_notes, stock_location — are what the
-- product page shows under "Only in the database" and what the connector's
-- transformation (apps/web/demo/transform.js) strips before indexing.
--
-- Replace it with your own data when adapting the template: a new migration
-- (040_…) that deletes these rows and inserts yours, never an edit to this one
-- (its checksum is in the manifest and in every database it was applied to).
insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (1, 'Aurora Wireless Headphones', 'Over-ear noise-cancelling headphones with 30h battery life and plush memory-foam earcups.', 'Audio', 199, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=640', 3.7, 87.5, 'SUP-ACME-014', 'Renegotiate freight Q3. Do not discount below 15%.', 'WH-EU-2 / Aisle 14', 120)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (2, 'Pulse True Wireless Earbuds', 'Compact in-ear earbuds with active noise cancellation and a pocketable charging case.', 'Audio', 129.99, 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=640', 1.2, 44.2, 'SUP-SONITEK-003', 'Batch 0824 has higher RMA rate; watch warranty claims.', 'WH-EU-2 / Aisle 07', 8)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (3, 'Basalt Portable Bluetooth Speaker', 'Rugged IP67 waterproof speaker delivering 360-degree sound and 24h playtime.', 'Audio', 89.5, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=640', 4.4, 33.75, 'SUP-ACME-021', 'Bundle with earbuds for Q4 promo. MOQ 500 for new colorways.', 'WH-US-1 / Aisle 03', 45)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (4, 'Meridian Studio Microphone', 'USB condenser microphone with cardioid pickup for streaming, podcasts and vocals.', 'Audio', 149, 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=640', 0.8, 58, 'SUP-VOXLINE-009', 'Supplier lead time slipped to 8 weeks; reorder early.', 'WH-EU-2 / Aisle 11', 0)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (5, 'Nimbus 14 Ultrabook Laptop', '14-inch aluminium laptop with a 12-core CPU, 16GB RAM and all-day battery.', 'Computing', 1299, 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=640', 4.9, 812.4, 'SUP-COREWAVE-002', 'Margin thin; never approve trade-in stacking with student rebate.', 'WH-US-1 / Aisle 22', 30)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (6, 'Vertex Mechanical Keyboard', 'Compact 75% hot-swappable mechanical keyboard with tactile switches and RGB backlight.', 'Computing', 119, 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=640', 2.6, 41.9, 'SUP-KEYFORGE-017', 'Keycap dye-sub defect flagged on run 3; QA hold before shipping.', 'WH-EU-2 / Aisle 05', 210)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (7, 'Glide Precision Wireless Mouse', 'Ergonomic wireless mouse with 26K DPI sensor, silent clicks and USB-C fast charging.', 'Computing', 59.99, 'https://images.unsplash.com/photo-1527814050087-3793815479db?w=640', 3.1, 18.6, 'SUP-KEYFORGE-018', 'Cheap alt supplier available; qualify before switching.', 'WH-EU-2 / Aisle 05', 340)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (8, 'Clarity 27 4K Monitor', '27-inch 4K IPS monitor with 99% sRGB coverage and a height-adjustable stand.', 'Computing', 379, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=640', 5.0, 214.3, 'SUP-COREWAVE-006', 'Panel allocation tight this quarter; confirm before promo push.', 'WH-US-1 / Aisle 19', 15)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (9, 'Orbit HD Streaming Webcam', '1080p webcam with autofocus, dual noise-cancelling mics and a privacy shutter.', 'Computing', 79, 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=640', 1.8, 27.5, 'SUP-VOXLINE-011', 'Firmware v2 fixes exposure bug; ship only updated units.', 'WH-EU-2 / Aisle 09', 60)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (10, 'Torrent 2TB Portable SSD', 'Pocket-sized USB-C SSD with 1050MB/s transfer and shock-resistant metal chassis.', 'Computing', 189, 'https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=640', 4.2, 96, 'SUP-DATACELL-004', 'NAND spot price volatile; review pricing monthly.', 'WH-US-1 / Aisle 12', 90)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (11, 'Cascade 65W USB-C Charger', 'Compact GaN wall charger with dual USB-C ports and foldable pins for travel.', 'Accessories', 39.99, 'https://images.unsplash.com/photo-1600490722773-35753aea6332?w=640', 0.3, 12.25, 'SUP-VOLTIQ-008', 'Certification renewal due Feb; block EU sales if lapsed.', 'WH-EU-2 / Aisle 02', 450)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (12, 'Anchor 10000mAh Power Bank', 'Slim power bank with 20W fast charging, USB-C in/out and a battery-level display.', 'Accessories', 45, 'https://images.unsplash.com/photo-1566554738544-d962991c3fee?w=640', 3.5, 15.8, 'SUP-VOLTIQ-010', 'Air freight restricted; sea only. Plan 6-week buffer.', 'WH-US-1 / Aisle 08', 175)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (13, 'Summit Adjustable Laptop Stand', 'Aluminium laptop stand with adjustable height and angle for better desk ergonomics.', 'Accessories', 49.5, 'https://images.unsplash.com/photo-1527689368864-3a821dbccc34?w=640', 2.2, 17.4, 'SUP-DESKPRO-005', 'Scratched-finish returns spiking; improve packaging insert.', 'WH-EU-2 / Aisle 16', 25)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (14, 'Harbor 7-in-1 USB-C Hub', 'USB-C hub with HDMI 4K, gigabit Ethernet, SD reader and 100W passthrough charging.', 'Accessories', 64.99, 'https://images.unsplash.com/photo-1625842268584-8f3296236761?w=640', 4.7, 22.9, 'SUP-VOLTIQ-013', 'Ethernet chip shortage; second-source qualification in progress.', 'WH-US-1 / Aisle 10', 3)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (15, 'Drift Woven Charging Cable 2m', 'Braided USB-C to USB-C cable rated for 100W charging and 20Gbps data transfer.', 'Accessories', 19.99, 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=640', 3.9, 4.6, 'SUP-VOLTIQ-014', 'High-margin add-on; push at checkout. Watch counterfeit listings.', 'WH-EU-2 / Aisle 02', 400)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (16, 'Halo Smart LED Bulb 2-Pack', 'Wi-Fi color-changing smart bulbs with voice control and scheduling via app.', 'Smart Home', 34.99, 'https://images.unsplash.com/photo-1550985616-10810253b84d?w=640', 1.5, 11.2, 'SUP-LUMEO-007', 'App backend migration in Q2; hold marketing until stable.', 'WH-US-1 / Aisle 05', 130)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (17, 'Sentinel Indoor Security Camera', '1080p indoor camera with night vision, motion alerts and two-way audio.', 'Smart Home', 59, 'https://images.unsplash.com/photo-1558002038-1055907df827?w=640', 2.8, 21.5, 'SUP-GUARDNET-012', 'Cloud storage upsell is the real margin; hardware near cost.', 'WH-EU-2 / Aisle 18', 50)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (18, 'Vale Smart Thermostat', 'Learning smart thermostat with room sensors, energy reports and app scheduling.', 'Smart Home', 149, 'https://images.unsplash.com/photo-1545259741-2ea3ebf61fa3?w=640', 0.6, 73, 'SUP-LUMEO-015', 'Utility rebate partnership pending; do not advertise rebate yet.', 'WH-US-1 / Aisle 14', 20)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (19, 'Gateway Smart Video Doorbell', 'Battery video doorbell with 2K resolution, person detection and cloud clips.', 'Smart Home', 99.99, 'https://images.unsplash.com/photo-1633194883650-df448a10d554?w=640', 3.3, 42.7, 'SUP-GUARDNET-016', 'Chime bundle returns high; ship with quick-start card v3.', 'WH-EU-2 / Aisle 18', 75)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

insert into products (id, name, description, category, price, image_url, rating, cost_price, supplier_id, internal_notes, stock_location, quantity) values (20, 'Ember Smart Plug 4-Pack', 'Wi-Fi smart plugs with energy monitoring, timers and voice-assistant support.', 'Smart Home', 42.99, 'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=640', 4.6, 14.3, 'SUP-LUMEO-019', 'Best-seller; keep 8-week safety stock. Never oversell bundle.', 'WH-US-1 / Aisle 06', 260)
on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    price = excluded.price,
    image_url = excluded.image_url,
    rating = excluded.rating,
    cost_price = excluded.cost_price,
    supplier_id = excluded.supplier_id,
    internal_notes = excluded.internal_notes,
    stock_location = excluded.stock_location,
    quantity = excluded.quantity,
    updated_at = now();

select count(*) from products;
