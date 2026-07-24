CREATE TABLE IF NOT EXISTS pib_report_generation_artifact_chunks (
  job_id TEXT NOT NULL REFERENCES pib_report_generation_jobs(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (job_id, chunk_index)
);
