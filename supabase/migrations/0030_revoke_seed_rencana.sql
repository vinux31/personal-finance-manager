-- Revoke client access to seed functions (closes IDOR write vulnerability BUG-2).
-- Functions retained in DB for audit trail; uncallable via REST API after this migration.
REVOKE EXECUTE ON FUNCTION seed_rencana(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION reset_rencana_marker() FROM authenticated;
