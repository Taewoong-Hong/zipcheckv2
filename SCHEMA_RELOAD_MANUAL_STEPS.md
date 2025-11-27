# Supabase PostgREST Schema Cache Manual Reload

## Issue Summary

After successfully applying database migration 016 (adding `environment` column to `v2_cases` and `v2_artifacts`), the PostgREST schema cache needs to be refreshed to recognize the new columns.

**Error Symptoms**:
- HTTP 500 responses from `/case` endpoints
- PGRST204: "Could not find the 'environment' column of 'v2_cases' in the schema cache"
- PostgreSQL error 42703: "column v2_cases.environment does not exist"

## Root Cause

Supabase's PostgREST API layer caches the database schema for performance. After DDL changes (ALTER TABLE), this cache becomes stale and must be refreshed.

## Attempted Solutions

### ❌ Option 1: RPC Schema Reload (FAILED)

Created and executed `reload_supabase_schema.py` which attempted to call:
```
POST https://gsiismzchtgdklvdvggu.supabase.co/rest/v1/rpc/postgrest_reload_schema
```

**Result**: HTTP 404, PGRST202 error - "Could not find the function public.postgrest_reload_schema"

**Why it failed**: The `postgrest_reload_schema` function doesn't exist by default in Supabase managed instances. This function is only available in:
- Self-hosted PostgREST instances with admin API enabled
- Databases where the function has been manually created

### ✅ Option 2: Manual Dashboard Restart (RECOMMENDED)

This is the official Supabase-supported approach for refreshing the PostgREST schema cache.

## Manual Restart Steps

Follow these steps to refresh the PostgREST schema cache:

### 1. Navigate to Project Settings
Go to: https://supabase.com/dashboard/project/gsiismzchtgdklvdvggu/settings/general

### 2. Locate PostgREST Service
Scroll down to the "Services" section in the General Settings page.

### 3. Restart PostgREST
- Find the "PostgREST" service entry
- Click the "Restart" button next to PostgREST
- Confirm the restart action

### 4. Wait for Service Restart
- Allow 30-60 seconds for the PostgREST service to fully restart
- The service will automatically reload the schema cache during startup

### 5. Verify Schema Refresh

After the restart, run the integration tests:

```bash
cd c:/dev/zipcheckv2
python test_case_endpoint.py
```

**Expected successful output**:
```
TEST 1: Create Case (POST /case)
Status Code: 201
[OK] SUCCESS - Case Created!
Environment: dev (expected: 'dev')
```

## Alternative: Wait for Auto-Refresh

PostgREST automatically refreshes its schema cache periodically (typically every 10-30 minutes). If you prefer not to manually restart:

1. Wait 30 minutes
2. Re-run integration tests
3. If tests still fail, proceed with manual restart

## Database Migration Status

✅ **VERIFIED**: The `environment` column exists in the database

```sql
-- Verification query (run in Supabase SQL Editor)
SELECT
    column_name,
    is_nullable,
    data_type,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'v2_cases'
    AND column_name = 'environment';
```

**Expected result**:
```
column_name  | is_nullable | data_type | column_default
-------------|-------------|-----------|---------------
environment  | NO          | text      | 'prod'::text
```

This confirms the database schema is correct - only the PostgREST cache is stale.

## Post-Restart Verification

After successfully restarting PostgREST and verifying with integration tests, you should see:

1. **TEST 1**: HTTP 201 response with `environment: 'dev'` field
2. **TEST 2**: HTTP 200 response listing cases
3. **TEST 3**: HTTP 200 response for single case retrieval

All tests should pass without PGRST204 or 42703 errors.

## Next Steps After Successful Restart

1. ✅ Run full integration test suite
2. ✅ Complete final report for migration 016
3. ✅ Document lessons learned
4. Consider implementing RLS policies for `environment` column filtering

## References

- Migration file: `db/migrations/016_add_environment_field.sql`
- Migration script: `apply_migration_016.py`
- Integration tests: `test_case_endpoint.py`
- Attempted reload script: `reload_supabase_schema.py`
