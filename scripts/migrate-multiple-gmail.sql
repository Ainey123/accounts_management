-- Migration: Allow multiple Gmail accounts per user
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql

-- Remove the unique constraint on userId in GmailAccount table
-- This allows each user to connect multiple Gmail accounts
DROP INDEX IF EXISTS "GmailAccount_userId_key";

-- Verify the constraint was removed (should return 0 rows if successful)
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'GmailAccount' 
  AND indexname = 'GmailAccount_userId_key';
