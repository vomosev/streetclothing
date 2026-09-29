--  STREET/PLATINUM — MySQL 8 schema (utf8mb4)
--  Usage:  mysql -u <user> -p <database> < schema.sql
--
--  NOTE: this file does NOT create or select a database so it can be applied to
--  whatever schema DB_NAME points at:
--      mysql -u root -p streetclothing < schema.sql
--  If you need the database itself, uncomment the two lines below.
--
-- CREATE DATABASE IF NOT EXISTS streetclothing CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE streetclothing;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS product_sizes;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190)    NOT NULL,
  password_hash VARCHAR(255)    NOT NULL,
  full_name     VARCHAR(120)    NOT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug        VARCHAR(160)    NOT NULL,
  name        VARCHAR(160)    NOT NULL,
  tagline     VARCHAR(255)    NOT NULL DEFAULT '',
  description TEXT            NULL,
  price_cents INT UNSIGNED    NOT NULL DEFAULT 0,
  -- 'tees' | 'hoodies' | 'outerwear' | 'pants' | 'accessories'
  category    VARCHAR(40)     NOT NULL DEFAULT 'tees',
  drop_name   VARCHAR(80)     NOT NULL DEFAULT 'Core',
  colorway    VARCHAR(80)     NOT NULL DEFAULT 'Black / Platinum',
  accent_hex  CHAR(7)         NOT NULL DEFAULT '#D6D8DC',
  in_stock    TINYINT(1)      NOT NULL DEFAULT 1,
  featured    TINYINT(1)      NOT NULL DEFAULT 0,
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_slug (slug),
  KEY idx_products_category (category),
  KEY idx_products_featured (featured),
  KEY idx_products_in_stock (in_stock)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- product_sizes
-- ---------------------------------------------------------------------------
CREATE TABLE product_sizes (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  label      VARCHAR(16)     NOT NULL,
  stock      INT             NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_product_size (product_id, label),
  KEY idx_product_sizes_product (product_id),
  CONSTRAINT fk_product_sizes_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NULL,
  reference   VARCHAR(120)    NULL,
  status      ENUM('pending','paid','failed','canceled') NOT NULL DEFAULT 'pending',
  total_cents INT UNSIGNED    NOT NULL DEFAULT 0,
  currency    CHAR(3)         NOT NULL DEFAULT 'USD',
  created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_reference (reference),
  KEY idx_orders_user (user_id),
  KEY idx_orders_status (status),
  CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
CREATE TABLE order_items (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id         BIGINT UNSIGNED NOT NULL,
  product_id       BIGINT UNSIGNED NULL,
  size_label       VARCHAR(16)     NOT NULL DEFAULT 'OS',
  quantity         INT UNSIGNED    NOT NULL DEFAULT 1,
  unit_price_cents INT UNSIGNED    NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  KEY idx_order_items_product (product_id),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Seed: demo user
-- Email:    demo@streetplatinum.com
-- Password: streetwear123
-- (bcrypt cost 10 hash of 'streetwear123')
-- ---------------------------------------------------------------------------
INSERT INTO users (email, password_hash, full_name) VALUES
  ('demo@streetplatinum.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Demo Member');

-- ---------------------------------------------------------------------------
-- Seed: 12 products
-- ---------------------------------------------------------------------------
INSERT INTO products (slug, name, tagline, description, price_cents, category, drop_name, colorway, accent_hex, in_stock, featured) VALUES
  ('platinum-seam-hoodie', 'Platinum Seam Hoodie', 'Heavyweight fleece with exposed platinum stitching.', 'A 480gsm brushed-back fleece hoodie cut boxy through the body with dropped shoulders. Exposed platinum contrast seams run the length of the sleeve, finished with a double-layer hood and heavy metal tipped drawcords. Garment dyed in small batches so no two pieces sit exactly the same.', 14800, 'hoodies', 'Platinum Vol. 3', 'Void Black / Platinum', '#D8DADF', 1, 1),
  ('midnight-cargo-pant', 'Midnight Cargo Pant', 'Ripstop utility cargo with tapered ankle.', 'Built from 8oz cotton ripstop with a water-repellent finish. Eight-pocket utility layout, articulated knees and a tapered ankle with adjustable snap cuffs. Sits mid-rise with a webbing belt included.', 16500, 'pants', 'Platinum Vol. 3', 'Midnight Black', '#9AA0A8', 1, 1),
  ('static-box-tee', 'Static Box Tee', 'Boxy 240gsm tee with static-print graphic.', 'A compact, boxy tee spun from 240gsm ringspun cotton. The static graphic is screen printed in three passes of platinum ink so it keeps its shine after wash. Pre-shrunk with a ribbed collar that holds its shape.', 6500, 'tees', 'Static', 'Black / Silver Static', '#C6C9CF', 1, 1),
  ('chrome-panel-jacket', 'Chrome Panel Jacket', 'Technical shell with reflective chrome panelling.', 'A three-layer technical shell with taped seams, storm flap and reflective chrome panels across the chest and back. Packs into its own left-hand pocket. Rated for wind and light rain.', 28900, 'outerwear', 'Nightshift', 'Black / Chrome', '#E2E4E8', 1, 1),
  ('asphalt-relaxed-tee', 'Asphalt Relaxed Tee', 'Washed cotton tee with a lived-in hand feel.', 'Enzyme-washed 220gsm cotton with a relaxed drop-shoulder fit. Subtle tonal chest embroidery and a soft, broken-in hand feel straight out of the box.', 5800, 'tees', 'Core', 'Asphalt Grey', '#8E949C', 1, 0),
  ('platinum-arc-crewneck', 'Platinum Arc Crewneck', 'Mid-weight crew with arc chest embroidery.', 'A 380gsm loopback cotton crewneck with ribbed side panels and a wide set collar. The arc logo is embroidered in platinum thread across the chest.', 12500, 'hoodies', 'Platinum Vol. 3', 'Black / Platinum Thread', '#D0D3D8', 1, 1),
  ('nightshift-coach-jacket', 'Nightshift Coach Jacket', 'Classic coach silhouette in matte black nylon.', 'Matte black nylon coach jacket with a mesh-lined body, snap front and elastic cuffs. Screen printed back graphic in reflective silver that lights up under headlights.', 19500, 'outerwear', 'Nightshift', 'Matte Black', '#B8BCC3', 1, 0),
  ('grain-wide-leg-pant', 'Grain Wide Leg Pant', 'Wide-leg twill with a heavy drape.', 'A 12oz cotton twill wide-leg pant with a deep pleat and a heavy drape. Full-length inseam with a clean hem so it stacks over any shoe.', 15200, 'pants', 'Core', 'Graphite', '#A2A7AE', 1, 0),
  ('platinum-strap-cap', 'Platinum Strap Cap', 'Unstructured six-panel with metal strap closure.', 'Unstructured six-panel cap in washed black cotton with a machined platinum strap closure and tonal eyelets. One size, adjustable.', 4500, 'accessories', 'Core', 'Washed Black', '#C9CCD2', 1, 0),
  ('foil-logo-beanie', 'Foil Logo Beanie', 'Ribbed merino blend with foil-stamped patch.', 'A tight-ribbed merino blend beanie with a foil-stamped leather patch. Wears cuffed or long.', 3800, 'accessories', 'Static', 'Black / Foil Silver', '#DDDFE3', 1, 0),
  ('overcast-zip-hoodie', 'Overcast Zip Hoodie', 'Full-zip fleece with tonal platinum hardware.', 'A full-zip 420gsm fleece hoodie with a two-way platinum zip, split kangaroo pockets and a lined hood. Cut slightly longer through the body.', 15800, 'hoodies', 'Nightshift', 'Overcast Black', '#B2B7BE', 0, 0),
  ('mirror-crossbody-bag', 'Mirror Crossbody Bag', 'Compact utility sling in coated ripstop.', 'A compact crossbody sling in coated ripstop with a mirrored platinum buckle, two internal card slots and a webbing strap that adjusts from shoulder to chest.', 7900, 'accessories', 'Platinum Vol. 3', 'Black / Mirror', '#E5E7EB', 1, 1);

-- ---------------------------------------------------------------------------
-- Seed: product sizes
-- ---------------------------------------------------------------------------
INSERT INTO product_sizes (product_id, label, stock)
SELECT p.id, s.label, s.stock FROM products p JOIN (
  SELECT 'S' AS label, 12 AS stock UNION ALL
  SELECT 'M', 18 UNION ALL
  SELECT 'L', 15 UNION ALL
  SELECT 'XL', 7 UNION ALL
  SELECT 'XXL', 0
) s WHERE p.slug = 'platinum-seam-hoodie';

INSERT INTO product_sizes (product_id, label, stock)
SELECT p.id, s.label, s.stock FROM products p JOIN (
  SELECT '28' AS label, 6 AS stock UNION ALL
  SELECT '30', 11 UNION ALL
  SELECT '32', 14 UNION ALL
  SELECT '34', 9 UNION ALL
  SELECT '36', 4
) s WHERE p.slug = 'midnight-cargo-pant';

INSERT INTO product_sizes (product_id, label, stock)
SELECT p.id, s.label, s.stock FROM products p JOIN (
  SELECT 'S' AS label, 20 AS stock UNION ALL
  SELECT 'M', 25 UNION ALL
  SELECT 'L', 22 UNION ALL
  SELECT 'XL', 10
) s WHERE p.slug = 'static-box-tee';

INSERT INTO product_sizes (product_id, label, stock)
SELECT p.id, s.label, s.stock FROM products p JOIN (
  SELECT 'S' AS label, 4 AS stock UNION ALL
  SELECT 'M', 8 UNION ALL
  SELECT 'L', 6 UNION ALL
  SELECT 'XL', 3
) s WHERE p.slug = 'chrome-panel-jacket';

INSERT INTO product_sizes (product_id, label, stock)
SELECT p.id, s.label, s.stock FROM products p JOIN (
  SELECT 'S' AS label, 14 AS stock UNION ALL
  SELECT 'M', 19 UNION ALL
  SELECT 'L', 17 UNION ALL
  SELECT 'XL', 8 UNION ALL
  SELECT 'XXL', 5
) s WHERE p.slug = 'asphalt-relaxed-tee';

INSERT INTO product_sizes (product_id, label, stock)
SELECT p.id, s.label, s.stock FROM products p JOIN (
  SELECT 'S' AS label, 9 AS stock UNION ALL
  SELECT 'M', 13 UNION ALL
  SELECT 'L', 11 UNION ALL
  SELECT 'XL', 6
) s WHERE p.slug = 'platinum-arc-crewneck';

INSERT INTO product_sizes (product_id, label, stock)
SELECT p.id, s.label, s.stock FROM products p JOIN (
  SELECT 'S' AS label, 5 AS stock UNION ALL
  SELECT 'M', 10 UNION ALL
  SELECT 'L', 9 UNION ALL
  SELECT 'XL', 2
) s WHERE p.slug = 'nightshift-coach-jacket';

INSERT INTO product_sizes (product_id, label, stock)
SELECT p.id, s.label, s.stock FROM products p JOIN (
  SELECT '28' AS label, 5 AS stock UNION ALL
  SELECT '30', 9 UNION ALL
  SELECT '32', 12 UNION ALL
  SELECT '34', 7 UNION ALL
  SELECT '36', 3
) s WHERE p.slug = 'grain-wide-leg-pant';

INSERT INTO product_sizes (product_id, label, stock)
SELECT p.id, 'OS', 34 FROM products p WHERE p.slug = 'platinum-strap-cap';

INSERT INTO product_sizes (product_id, label, stock)
SELECT p.id, 'OS', 41 FROM products p WHERE p.slug = 'foil-logo-beanie';

INSERT INTO product_sizes (product_id, label, stock)
SELECT p.id, s.label, s.stock FROM products p JOIN (
  SELECT 'S' AS label, 0 AS stock UNION ALL
  SELECT 'M', 0 UNION ALL
  SELECT 'L', 0 UNION ALL
  SELECT 'XL', 0
) s WHERE p.slug = 'overcast-zip-hoodie';

INSERT INTO product_sizes (product_id, label, stock)
SELECT p.id, 'OS', 16 FROM products p WHERE p.slug = 'mirror-crossbody-bag';