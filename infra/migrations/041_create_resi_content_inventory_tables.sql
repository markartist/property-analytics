-- Resi content inventory and Data Pond content-system bindings.
-- This is a read-first governance layer. Live Resi writes require a separate
-- explicit approval/apply path and are not performed by inventory collection.

CREATE TABLE IF NOT EXISTS resi_content_inventory_runs (
  run_id TEXT PRIMARY KEY,
  source_snapshot_id TEXT,
  snapshot_date DATE NOT NULL,
  fetched_at TEXT NOT NULL,
  api_base_url TEXT NOT NULL,
  account_id TEXT,
  account_name TEXT,
  properties_seen INTEGER NOT NULL DEFAULT 0,
  properties_resolved INTEGER NOT NULL DEFAULT 0,
  content_objects_seen INTEGER NOT NULL DEFAULT 0,
  content_fields_seen INTEGER NOT NULL DEFAULT 0,
  media_assets_seen INTEGER NOT NULL DEFAULT 0,
  source_payload_sha256 TEXT NOT NULL,
  warning_count INTEGER NOT NULL DEFAULT 0,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  collection_manifest_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resi_content_inventory_runs_fetched
  ON resi_content_inventory_runs(fetched_at DESC);

CREATE TABLE IF NOT EXISTS resi_content_objects (
  run_id TEXT NOT NULL,
  source_api TEXT NOT NULL DEFAULT 'resi_v2',
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  parent_object_type TEXT,
  parent_object_id TEXT,
  resi_property_id TEXT,
  property_code TEXT,
  community_id TEXT,
  canonical_property_id TEXT,
  identity_status TEXT NOT NULL DEFAULT 'unknown',
  is_global INTEGER,
  is_enabled INTEGER,
  lifecycle_status TEXT NOT NULL DEFAULT 'observed',
  internal_title TEXT,
  public_title TEXT,
  public_subtitle TEXT,
  text_summary TEXT,
  media_type TEXT,
  link_count INTEGER NOT NULL DEFAULT 0,
  media_count INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER,
  elements_key TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT,
  raw_payload_sha256 TEXT NOT NULL,
  raw_object_json TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (run_id, object_type, object_id),
  FOREIGN KEY (run_id) REFERENCES resi_content_inventory_runs(run_id)
);

CREATE INDEX IF NOT EXISTS idx_resi_content_objects_property
  ON resi_content_objects(property_code, object_type, is_enabled);

CREATE INDEX IF NOT EXISTS idx_resi_content_objects_external
  ON resi_content_objects(object_type, object_id);

CREATE INDEX IF NOT EXISTS idx_resi_content_objects_updated
  ON resi_content_objects(updated_at);

CREATE TABLE IF NOT EXISTS resi_content_property_links (
  run_id TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  resi_property_id TEXT NOT NULL,
  property_code TEXT,
  community_id TEXT,
  canonical_property_id TEXT,
  link_source TEXT NOT NULL,
  identity_status TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (run_id, object_type, object_id, resi_property_id),
  FOREIGN KEY (run_id, object_type, object_id)
    REFERENCES resi_content_objects(run_id, object_type, object_id)
);

CREATE INDEX IF NOT EXISTS idx_resi_content_property_links_property
  ON resi_content_property_links(property_code, object_type);

CREATE TABLE IF NOT EXISTS resi_content_fields (
  run_id TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  field_path TEXT NOT NULL,
  field_role TEXT NOT NULL,
  field_value_kind TEXT NOT NULL,
  field_value_text TEXT,
  field_value_sha256 TEXT,
  property_code TEXT,
  community_id TEXT,
  editability_class TEXT NOT NULL,
  owning_system TEXT NOT NULL,
  resi_update_method TEXT,
  resi_update_path_template TEXT,
  safety_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (run_id, object_type, object_id, field_path),
  FOREIGN KEY (run_id, object_type, object_id)
    REFERENCES resi_content_objects(run_id, object_type, object_id)
);

CREATE INDEX IF NOT EXISTS idx_resi_content_fields_property_role
  ON resi_content_fields(property_code, field_role, editability_class);

CREATE INDEX IF NOT EXISTS idx_resi_content_fields_hash
  ON resi_content_fields(field_value_sha256);

CREATE TABLE IF NOT EXISTS pond_content_system_bindings (
  binding_id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  source_api TEXT NOT NULL,
  source_object_type TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  source_field_path TEXT,
  property_code TEXT,
  community_id TEXT,
  internal_system TEXT NOT NULL,
  internal_entity_type TEXT NOT NULL,
  internal_entity_id TEXT,
  binding_status TEXT NOT NULL DEFAULT 'candidate',
  confidence REAL NOT NULL DEFAULT 0,
  rationale TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (source_system, source_api, source_object_type, source_object_id, source_field_path, internal_system, internal_entity_type, internal_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_pond_content_system_bindings_source
  ON pond_content_system_bindings(source_system, source_object_type, source_object_id);

CREATE INDEX IF NOT EXISTS idx_pond_content_system_bindings_internal
  ON pond_content_system_bindings(internal_system, internal_entity_type, internal_entity_id);

CREATE TABLE IF NOT EXISTS pond_content_change_requests (
  change_request_id TEXT PRIMARY KEY,
  source_system TEXT NOT NULL,
  source_api TEXT NOT NULL,
  source_object_type TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  source_field_path TEXT NOT NULL,
  property_code TEXT,
  community_id TEXT,
  originating_system TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  current_value_sha256 TEXT,
  proposed_value_text TEXT,
  proposed_payload_json TEXT NOT NULL DEFAULT '{}',
  editability_class TEXT NOT NULL,
  approval_status TEXT NOT NULL DEFAULT 'draft',
  apply_status TEXT NOT NULL DEFAULT 'not_applicable',
  resi_update_method TEXT,
  resi_update_path_template TEXT,
  approved_by TEXT,
  approved_at TEXT,
  applied_by TEXT,
  applied_at TEXT,
  readback_run_id TEXT,
  readback_value_sha256 TEXT,
  blocked_reason TEXT,
  audit_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pond_content_change_requests_status
  ON pond_content_change_requests(approval_status, apply_status, requested_at);

CREATE INDEX IF NOT EXISTS idx_pond_content_change_requests_source
  ON pond_content_change_requests(source_system, source_object_type, source_object_id, source_field_path);

CREATE TABLE IF NOT EXISTS resi_content_changeability_rules (
  rule_id TEXT PRIMARY KEY,
  source_api TEXT NOT NULL DEFAULT 'resi_v2',
  object_type TEXT NOT NULL,
  field_path TEXT NOT NULL,
  field_role TEXT NOT NULL,
  editability_class TEXT NOT NULL,
  owning_system TEXT NOT NULL,
  resi_update_method TEXT,
  resi_update_path_template TEXT,
  safety_notes TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (source_api, object_type, field_path)
);

INSERT OR IGNORE INTO resi_content_changeability_rules (
  rule_id, object_type, field_path, field_role, editability_class, owning_system,
  resi_update_method, resi_update_path_template, safety_notes, created_at, updated_at
) VALUES
  ('resi_rule_content_block_title', 'content_block', 'title', 'public_copy', 'safe_content_change', 'Content Office', 'PATCH', '/content-blocks/{id}', 'Visible website copy; verify global/property scope before approval.', datetime('now'), datetime('now')),
  ('resi_rule_content_block_subtitle', 'content_block', 'subtitle', 'public_copy', 'safe_content_change', 'Content Office', 'PATCH', '/content-blocks/{id}', 'Visible website copy; verify global/property scope before approval.', datetime('now'), datetime('now')),
  ('resi_rule_content_block_description', 'content_block', 'description', 'public_copy', 'safe_content_change', 'Content Office', 'PATCH', '/content-blocks/{id}', 'Visible website copy; preserve approved claims and proof source.', datetime('now'), datetime('now')),
  ('resi_rule_content_block_enabled', 'content_block', 'is_enabled', 'publication_state', 'publication_sensitive', 'Content Office', 'PATCH', '/content-blocks/{id}', 'Can hide or reveal live sections; requires explicit approval.', datetime('now'), datetime('now')),
  ('resi_rule_content_item_title', 'content_item', 'title', 'public_copy', 'safe_content_change', 'Content Office', 'PATCH', '/content-blocks/{parent_id}', 'Nested item update is owned through the parent content block payload.', datetime('now'), datetime('now')),
  ('resi_rule_content_item_text', 'content_item', 'text', 'public_copy', 'safe_content_change', 'Content Office', 'PATCH', '/content-blocks/{parent_id}', 'Nested item update is owned through the parent content block payload.', datetime('now'), datetime('now')),
  ('resi_rule_announcement_title', 'announcement', 'title', 'public_copy', 'safe_content_change', 'Content Office', 'PATCH', '/announcements/{id}', 'Visible announcement copy; check active date window before approval.', datetime('now'), datetime('now')),
  ('resi_rule_announcement_text', 'announcement', 'text', 'public_copy', 'safe_content_change', 'Content Office', 'PATCH', '/announcements/{id}', 'Visible announcement copy; check active date window before approval.', datetime('now'), datetime('now')),
  ('resi_rule_announcement_dates', 'announcement', 'starts_at', 'publication_state', 'publication_sensitive', 'Content Office', 'PATCH', '/announcements/{id}', 'Changes timing of live announcement visibility.', datetime('now'), datetime('now')),
  ('resi_rule_faq_question', 'faq', 'question', 'public_copy', 'safe_content_change', 'Site Content', 'PATCH', '/faqs/{id}', 'FAQ question is public content; maintain renter-language clarity.', datetime('now'), datetime('now')),
  ('resi_rule_faq_answer', 'faq', 'answer', 'public_copy', 'safe_content_change', 'Site Content', 'PATCH', '/faqs/{id}', 'FAQ answer is public content; avoid unsupported policy claims.', datetime('now'), datetime('now')),
  ('resi_rule_gallery_title', 'gallery', 'title', 'public_copy', 'safe_content_change', 'Content Office', 'PATCH', '/galleries/{id}', 'Gallery label/intro content; media membership deletion is not API-supported.', datetime('now'), datetime('now')),
  ('resi_rule_media_file_caption', 'media_file', 'caption', 'media_metadata', 'media_global_asset_change', 'Content Office', 'PATCH', '/media/{id}', 'File caption is asset-level and changes everywhere the file is attached.', datetime('now'), datetime('now')),
  ('resi_rule_media_file_alt', 'media_file', 'alt_text', 'media_accessibility', 'media_global_asset_change', 'Content Office', 'PATCH', '/media/{id}', 'File alt text is asset-level and changes everywhere the file is attached.', datetime('now'), datetime('now')),
  ('resi_rule_media_embed_title', 'media_embed', 'title', 'media_metadata', 'media_local_embed_change', 'Content Office', 'PATCH', '/media/{id}', 'Embed metadata is local to its single placement.', datetime('now'), datetime('now')),
  ('resi_rule_neighborhood_name', 'neighborhood_place', 'name', 'location_content', 'safe_content_change', 'Site Content', 'PATCH', '/neighborhood-places/{id}', 'Neighborhood place content; verify map/category context.', datetime('now'), datetime('now')),
  ('resi_rule_amenity_name', 'amenity', 'name', 'amenity_content', 'safe_content_change', 'Site Content', 'PATCH', '/amenities/{id}', 'Amenity labels are renter-facing; verify property applicability.', datetime('now'), datetime('now')),
  ('resi_rule_review_text', 'review', 'text', 'reputation_content', 'rights_sensitive', 'Reputation / Content Office', 'PATCH', '/reviews/{id}', 'Review content can carry syndication and rights constraints; require source/rights review.', datetime('now'), datetime('now')),
  ('resi_rule_fee_amount', 'fee', 'amount', 'operational_fact', 'operational_sensitive', 'Operations / PMS', 'PATCH', '/fees/{id}', 'Fee and pricing-adjacent fields are operational facts; do not treat as marketing copy.', datetime('now'), datetime('now'));
