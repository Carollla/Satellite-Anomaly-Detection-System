-- SPACEMAN local/client database schema draft.
-- The current implementation stores the same structure in data/spaceman-db.json.
-- This schema is kept for the later SQLite/PostgreSQL migration.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL,
  auth_provider TEXT NOT NULL DEFAULT 'local',
  login_count INTEGER NOT NULL DEFAULT 0,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE api_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  base_url TEXT,
  model TEXT,
  api_key_ref TEXT,
  api_key_masked TEXT,
  status TEXT NOT NULL DEFAULT 'missing-key',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE constellation_configs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 0,
  total_satellites INTEGER NOT NULL DEFAULT 0,
  shell_count INTEGER NOT NULL DEFAULT 0,
  source TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE satellite_shells (
  id TEXT PRIMARY KEY,
  constellation_id TEXT NOT NULL,
  shell_key TEXT NOT NULL,
  name TEXT NOT NULL,
  orbit_class TEXT NOT NULL,
  walker TEXT,
  total INTEGER NOT NULL,
  planes INTEGER NOT NULL DEFAULT 1,
  phasing INTEGER NOT NULL DEFAULT 0,
  altitude_km REAL NOT NULL,
  inclination_deg REAL NOT NULL,
  color TEXT,
  FOREIGN KEY (constellation_id) REFERENCES constellation_configs(id)
);

CREATE TABLE satellites (
  id TEXT PRIMARY KEY,
  constellation_id TEXT NOT NULL,
  norad_id INTEGER,
  name TEXT NOT NULL,
  shell_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  visible INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'user-created',
  orbit_class TEXT,
  altitude_km REAL NOT NULL,
  inclination_deg REAL NOT NULL,
  eccentricity REAL NOT NULL DEFAULT 0.0001,
  raan_deg REAL NOT NULL DEFAULT 0,
  mean_anomaly_deg REAL NOT NULL DEFAULT 0,
  plane INTEGER NOT NULL DEFAULT 0,
  slot INTEGER NOT NULL DEFAULT 0,
  payload_config_id TEXT,
  external_backend_id TEXT,
  api_status TEXT NOT NULL DEFAULT 'unbound',
  last_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (constellation_id) REFERENCES constellation_configs(id),
  FOREIGN KEY (payload_config_id) REFERENCES api_configs(id)
);

CREATE TABLE constellation_change_logs (
  id TEXT PRIMARY KEY,
  time TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  before_json TEXT,
  after_json TEXT,
  note TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_satellites_shell ON satellites(shell_key);
CREATE INDEX idx_change_logs_time ON constellation_change_logs(time DESC);
