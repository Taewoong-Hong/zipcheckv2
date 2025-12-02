"""
Reload Supabase Schema Cache

After applying database migrations, Supabase's PostgREST API layer needs to reload
its schema cache to recognize new columns/tables.

Error fixed:
- PGRST204: "Could not find the 'environment' column of 'v2_cases' in the schema cache"
"""
import os
import httpx
from dotenv import load_dotenv

# Load environment variables
load_dotenv('services/ai/.env')

def reload_schema():
    """Reload Supabase PostgREST schema cache via Admin API"""

    # Get Supabase URL and Service Role Key
    database_url = os.getenv('DATABASE_URL')
    service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

    if not database_url or not service_role_key:
        print("[ERROR] Missing DATABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
        return False

    # Extract Supabase project URL from DATABASE_URL
    # Example: postgresql://postgres.gsiismzchtgdklvdvggu:...@aws-0-...
    project_ref = database_url.split('postgres.')[1].split(':')[0]
    supabase_url = f"https://{project_ref}.supabase.co"

    print("=" * 80)
    print("RELOAD SUPABASE SCHEMA CACHE")
    print("=" * 80)
    print(f"\nSupabase URL: {supabase_url}")
    print(f"Service Role Key: {service_role_key[:20]}...")

    # PostgREST Admin API endpoint for schema reload
    reload_url = f"{supabase_url}/rest/v1/rpc/postgrest_reload_schema"

    print(f"\n[*] Sending schema reload request...")
    print(f"    URL: {reload_url}")

    try:
        response = httpx.post(
            reload_url,
            headers={
                "apikey": service_role_key,
                "Authorization": f"Bearer {service_role_key}",
                "Content-Type": "application/json"
            },
            timeout=30.0
        )

        print(f"\n[<<] Response:")
        print(f"    Status: {response.status_code}")
        print(f"    Headers: {dict(response.headers)}")

        if response.status_code in [200, 201, 204]:
            print("\n[OK] Schema cache reloaded successfully!")
            print("\nNext steps:")
            print("   1. Re-run integration tests: python test_case_endpoint.py")
            print("   2. Verify HTTP 201/200 responses (not 500)")
            return True
        else:
            print(f"\n[ERROR] Failed to reload schema cache")
            print(f"Response: {response.text}")
            return False

    except Exception as e:
        print(f"\n[ERROR] Request failed: {e}")
        return False


if __name__ == "__main__":
    success = reload_schema()

    if not success:
        print("\n[INFO] Alternative: Restart Supabase PostgREST service via Dashboard:")
        print("   1. Go to: https://supabase.com/dashboard/project/gsiismzchtgdklvdvggu/settings/general")
        print("   2. Restart PostgREST service")
        print("   3. Wait 30 seconds for service to come back online")
        exit(1)
