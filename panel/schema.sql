-- OpenShelf panel (Cloudflare D1). Apply with: npx wrangler d1 execute openshelf-panel --remote --file schema.sql
CREATE TABLE IF NOT EXISTS nodes (
  id          TEXT PRIMARY KEY,          -- random id chosen by the admin server
  public_key  TEXT NOT NULL,             -- Ed25519 public key (base64url, raw); pinned on first contact
  name        TEXT NOT NULL DEFAULT '',
  version     TEXT NOT NULL DEFAULT '',
  tunnel_url  TEXT,                      -- https://<random>.trycloudflare.com while online
  snapshot    TEXT NOT NULL DEFAULT '{}',-- last reported members/content summary (JSON)
  last_seen   INTEGER NOT NULL,          -- unix ms
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS nodes_last_seen ON nodes (last_seen);

CREATE TABLE IF NOT EXISTS audit (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  at        INTEGER NOT NULL,
  action    TEXT NOT NULL,
  node_id   TEXT,
  ip        TEXT
);
