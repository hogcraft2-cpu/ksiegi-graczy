-- Skryptorium: katalog, bezpieczne hasze haseł i limity dostępu
CREATE TABLE IF NOT EXISTS books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  year TEXT NOT NULL DEFAULT '',
  cover TEXT NOT NULL DEFAULT 'burgundy',
  paper TEXT NOT NULL DEFAULT 'classic',
  spine TEXT NOT NULL DEFAULT 'illuminated',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 1,
  salt TEXT NOT NULL,
  hash TEXT NOT NULL,
  ai_uses INTEGER NOT NULL DEFAULT 0,
  ai_day TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS books_published_created ON books(published, created_at DESC);
CREATE TABLE IF NOT EXISTS quotas (
  key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 0,
  expires INTEGER NOT NULL
);
