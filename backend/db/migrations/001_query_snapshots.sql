-- Aeolus 本地查询历史（SQLite）
CREATE TABLE IF NOT EXISTS query_snapshots (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  vendor TEXT NOT NULL DEFAULT 'mx',
  select_type TEXT NOT NULL DEFAULT '',
  input_query TEXT,
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  result_payload TEXT,
  snapshot_dir TEXT
);

CREATE INDEX IF NOT EXISTS query_snapshots_created_at_idx
  ON query_snapshots (created_at DESC);

CREATE INDEX IF NOT EXISTS query_snapshots_skill_id_idx
  ON query_snapshots (skill_id);
