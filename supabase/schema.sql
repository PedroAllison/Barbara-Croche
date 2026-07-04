-- ============================================================
-- Barbara Crochê - Estrutura do banco (Supabase / Postgres)
-- Cole TODO este conteúdo no Supabase: SQL Editor > New query > Run
-- Pode rodar mais de uma vez sem problema (é idempotente).
-- ============================================================

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id   SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  color       TEXT,
  description TEXT,
  cost_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  sale_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity    INTEGER NOT NULL DEFAULT 0,
  min_stock   INTEGER NOT NULL DEFAULT 0,
  photo       TEXT,          -- URL pública da foto (Supabase Storage)
  photo_path  TEXT,          -- caminho interno no Storage (para apagar depois)
  sku         TEXT,
  published   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,            -- 'in' | 'out'
  reason     TEXT,
  quantity   INTEGER NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id          SERIAL PRIMARY KEY,
  type        TEXT NOT NULL,           -- 'purchase' | 'sale'
  description TEXT,
  amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  file_path   TEXT,                    -- URL pública do arquivo (Storage)
  file_key    TEXT,                    -- caminho interno no Storage
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_transactions (
  id          SERIAL PRIMARY KEY,
  type        TEXT NOT NULL,           -- 'revenue' | 'expense'
  description TEXT,
  amount      NUMERIC(12,2) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id          SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  product_id  INTEGER REFERENCES products(id) ON DELETE SET NULL,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'novo',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shipping_rates (
  id     SERIAL PRIMARY KEY,
  region TEXT NOT NULL UNIQUE,
  price  NUMERIC(12,2) NOT NULL,
  days   TEXT
);

-- ------------------------------------------------------------
-- Dados iniciais (só insere se ainda não existir)
-- ------------------------------------------------------------
INSERT INTO settings (key, value) VALUES
  ('store_name', 'Barbara Crochê'),
  ('store_tagline', 'Linhas, agulhas e tudo para o seu crochê'),
  ('seller_name', 'Barbara'),
  ('seller_phone', '(00) 00000-0000'),
  ('seller_whatsapp', '5500000000000'),
  ('seller_email', 'contato@barbaracroche.com'),
  ('initial_cash', '0')
ON CONFLICT (key) DO NOTHING;

INSERT INTO categories (name) VALUES
  ('Linhas'), ('Fios'), ('Agulhas de Crochê'), ('Agulhas de Tricô'),
  ('Acessórios'), ('Kits'), ('Outros')
ON CONFLICT (name) DO NOTHING;

INSERT INTO shipping_rates (region, price, days) VALUES
  ('Sudeste', 15.00, '3 a 7 dias úteis'),
  ('Sul', 20.00, '4 a 9 dias úteis'),
  ('Centro-Oeste', 22.00, '5 a 10 dias úteis'),
  ('Nordeste', 28.00, '6 a 12 dias úteis'),
  ('Norte', 35.00, '8 a 15 dias úteis')
ON CONFLICT (region) DO NOTHING;
