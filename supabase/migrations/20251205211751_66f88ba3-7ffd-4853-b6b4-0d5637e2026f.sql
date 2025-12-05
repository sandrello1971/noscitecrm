-- Drop unused banking tables that have overly permissive RLS policies
-- These features are intentionally not implemented per project constraints

DROP TABLE IF EXISTS bank_transactions CASCADE;
DROP TABLE IF EXISTS bank_statements CASCADE;