-- Sprint 1: GIN index för snabb JSONB-sökning på artikelnummer i metadata
CREATE INDEX IF NOT EXISTS idx_kb_metadata_gin 
ON knowledge_base USING gin (metadata jsonb_path_ops);

COMMENT ON INDEX idx_kb_metadata_gin IS 'Snabb sökning på metadata-fält för artikelnummer (oe_no, alt_nos)';