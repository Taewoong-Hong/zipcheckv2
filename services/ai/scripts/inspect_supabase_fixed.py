"""
Supabase    Storage   
"""
import os
import sys
from pathlib import Path

#   sys.path 
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
import psycopg
from supabase import create_client, Client
import json

# .env 
env_path = project_root / ".env"
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def inspect_database_schema():
    """PostgreSQL    """
    print("\n" + "=" * 80)
    print("[DB] DATABASE SCHEMA INSPECTION")
    print("=" * 80)

    conn = psycopg.connect(DATABASE_URL)
    cur = conn.cursor()

    # 1. v2_  
    print("\n1 V2   (v2_ prefix)")
    print("-" * 80)
    cur.execute("""
        SELECT
            tablename,
            schemaname,
            hasindexes,
            hasrules,
            hastriggers
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE 'v2_%'
        ORDER BY tablename;
    """)

    v2_tables = cur.fetchall()
    print(f" {len(v2_tables)} ")
    for row in v2_tables:
        print(f"  - {row[0]} (indexes={row[2]}, rules={row[3]}, triggers={row[4]})")

    # 2.   
    print("\n2    (conversations, messages)")
    print("-" * 80)
    cur.execute("""
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND (tablename LIKE '%conversation%' OR tablename LIKE '%message%')
        ORDER BY tablename;
    """)

    chat_tables = cur.fetchall()
    for row in chat_tables:
        print(f"  - {row[0]}")

    # 3. RLS  
    print("\n3 RLS (Row Level Security)  ")
    print("-" * 80)
    cur.execute("""
        SELECT
            tablename,
            rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
        AND (tablename LIKE 'v2_%' OR tablename IN ('conversations', 'messages'))
        ORDER BY tablename;
    """)

    rls_status = cur.fetchall()
    for row in rls_status:
        status = "[OK] ON" if row[1] else "[ERR] OFF"
        print(f"  {row[0]:40} {status}")

    # 4. RLS  
    print("\n4 RLS  ")
    print("-" * 80)
    cur.execute("""
        SELECT
            schemaname,
            tablename,
            COUNT(*) as policy_count
        FROM pg_policies
        WHERE schemaname = 'public'
        GROUP BY schemaname, tablename
        ORDER BY tablename;
    """)

    policies = cur.fetchall()
    total_policies = sum(row[2] for row in policies)
    print(f" {total_policies} ")
    for row in policies:
        print(f"  {row[1]:40} {row[2]:2}")

    # 5. Foreign Key 
    print("\n5 Foreign Key ")
    print("-" * 80)
    cur.execute("""
        SELECT
            tc.table_name AS from_table,
            kcu.column_name AS from_column,
            ccu.table_name AS to_table,
            ccu.column_name AS to_column,
            rc.delete_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        JOIN information_schema.referential_constraints AS rc
            ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            AND (tc.table_name LIKE 'v2_%' OR tc.table_name IN ('conversations', 'messages'))
        ORDER BY from_table, to_table;
    """)

    fks = cur.fetchall()
    print(f" {len(fks)} FK")
    current_table = None
    for row in fks:
        from_table, from_col, to_table, to_col, delete_rule = row
        if from_table != current_table:
            print(f"\n  [TABLE] {from_table}")
            current_table = from_table
        print(f"    -> {from_col}  {to_table}.{to_col} ({delete_rule})")

    # 6.  
    print("\n6  ")
    print("-" * 80)
    cur.execute("""
        SELECT
            t.tablename,
            i.indexname,
            array_agg(a.attname ORDER BY a.attnum) AS columns
        FROM pg_indexes i
        JOIN pg_class c ON c.relname = i.indexname
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_index ix ON ix.indexrelid = c.oid
        JOIN pg_class t ON t.oid = ix.indrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE i.schemaname = 'public'
            AND (t.relname LIKE 'v2_%' OR t.relname IN ('conversations', 'messages'))
            AND NOT ix.indisprimary  -- PK 
        GROUP BY t.tablename, i.indexname
        ORDER BY t.tablename, i.indexname;
    """)

    indexes = cur.fetchall()
    print(f" {len(indexes)}  (PK )")
    current_table = None
    for row in indexes:
        table, index_name, columns = row
        if table != current_table:
            print(f"\n  [TABLE] {table}")
            current_table = table
        print(f"    {index_name}: {', '.join(columns)}")

    # 7.   (v2_cases, v2_artifacts, v2_reports)
    print("\n7    ")
    print("-" * 80)

    for table_name in ['v2_cases', 'v2_artifacts', 'v2_reports']:
        print(f"\n  [TABLE] {table_name}")
        cur.execute("""
            SELECT
                column_name,
                data_type,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_schema = 'public'
                AND table_name = %s
            ORDER BY ordinal_position;
        """, (table_name,))

        columns = cur.fetchall()
        for col in columns:
            col_name, dtype, nullable, default = col
            null_str = "NULL" if nullable == "YES" else "NOT NULL"
            default_str = f" = {default}" if default else ""
            print(f"    {col_name:30} {dtype:20} {null_str:10}{default_str}")

    # 8. Storage  (storage.buckets)
    print("\n8 Storage  ")
    print("-" * 80)
    cur.execute("""
        SELECT
            id,
            name,
            public,
            file_size_limit,
            allowed_mime_types,
            created_at
        FROM storage.buckets
        ORDER BY name;
    """)

    buckets = cur.fetchall()
    print(f" {len(buckets)} ")
    for row in buckets:
        bucket_id, name, is_public, size_limit, mime_types, created = row
        public_str = "[PUBLIC] Public" if is_public else "[PRIVATE] Private"
        size_mb = size_limit / (1024 * 1024) if size_limit else ""
        print(f"\n  {name} ({public_str})")
        print(f"    ID: {bucket_id}")
        print(f"     : {size_mb}MB" if isinstance(size_mb, str) else f"     : {size_mb:.1f}MB")
        print(f"     MIME: {mime_types or ''}")
        print(f"    : {created}")

    # 9. Storage RLS 
    print("\n9 Storage RLS ")
    print("-" * 80)
    cur.execute("""
        SELECT
            bucket_id,
            name,
            definition
        FROM storage.policies
        ORDER BY bucket_id, name;
    """)

    storage_policies = cur.fetchall()
    print(f" {storage_policies and len(storage_policies) or 0} Storage ")
    current_bucket = None
    for row in storage_policies:
        bucket, policy_name, definition = row
        if bucket != current_bucket:
            print(f"\n  [BUCKET] {bucket}")
            current_bucket = bucket
        print(f"    {policy_name}")
        print(f"      {definition[:100]}..." if len(definition) > 100 else f"      {definition}")

    # 10. 
    print("\n[10]  ")
    print("-" * 80)

    for table_name in ['v2_cases', 'v2_artifacts', 'v2_reports', 'conversations', 'messages']:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table_name};")
            count = cur.fetchone()[0]
            print(f"  {table_name:30} {count:>10,} rows")
        except Exception as e:
            print(f"  {table_name:30} ( : {e})")

    cur.close()
    conn.close()


def inspect_storage_buckets():
    """Supabase Storage   """
    print("\n" + "=" * 80)
    print("[BUCKET] STORAGE BUCKET INSPECTION")
    print("=" * 80)

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # 1.  
    print("\n1  ")
    print("-" * 80)
    try:
        buckets = supabase.storage.list_buckets()
        print(f" {len(buckets)} ")
        for bucket in buckets:
            print(f"\n  {bucket.name}")
            print(f"    ID: {bucket.id}")
            print(f"    Public: {'[PUBLIC] Yes' if bucket.public else '[PRIVATE] No'}")
            print(f"     : {bucket.file_size_limit / (1024*1024) if bucket.file_size_limit else ''}MB")
            print(f"     MIME: {bucket.allowed_mime_types or ''}")
    except Exception as e:
        print(f"   : {e}")

    # 2. artifacts    
    print("\n2 artifacts     ( 10)")
    print("-" * 80)
    try:
        files = supabase.storage.from_('artifacts').list(limit=100)

        #   
        total_files = len(files) if files else 0
        print(f" /: {total_files}")

        if files:
            for idx, file in enumerate(files[:10], 1):
                file_name = file.get('name', 'N/A')
                file_id = file.get('id', 'N/A')

                print(f"\n  {idx}. {file_name}")
                print(f"     ID: {file_id}")

                #   
                if file.get('metadata') is None or not file.get('metadata', {}).get('size'):
                    try:
                        sub_files = supabase.storage.from_('artifacts').list(file_name, limit=5)
                        if sub_files:
                            print(f"      : {len(sub_files)}")
                            for sub_file in sub_files[:3]:
                                sub_name = sub_file.get('name', 'N/A')
                                print(f"       - {sub_name}")
                    except Exception as e:
                        print(f"        : {e}")
                else:
                    #  
                    metadata = file.get('metadata', {})
                    size = metadata.get('size', 0)
                    mime = metadata.get('mimetype', 'N/A')
                    print(f"     : {size:,} bytes")
                    print(f"     MIME: {mime}")
    except Exception as e:
        print(f"artifacts   : {e}")


def save_schema_json():
    """ JSON   ()"""
    print("\n" + "=" * 80)
    print("[SAVE]  JSON ")
    print("=" * 80)

    conn = psycopg.connect(DATABASE_URL)
    cur = conn.cursor()

    schema = {
        "v2_tables": [],
        "chat_tables": [],
        "foreign_keys": [],
        "rls_policies": [],
        "indexes": [],
        "storage_buckets": []
    }

    # v2 
    cur.execute("""
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename LIKE 'v2_%'
        ORDER BY tablename;
    """)
    schema["v2_tables"] = [row[0] for row in cur.fetchall()]

    #  
    cur.execute("""
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public'
        AND (tablename LIKE '%conversation%' OR tablename LIKE '%message%')
        ORDER BY tablename;
    """)
    schema["chat_tables"] = [row[0] for row in cur.fetchall()]

    # Foreign Keys
    cur.execute("""
        SELECT
            tc.table_name,
            kcu.column_name,
            ccu.table_name,
            ccu.column_name,
            rc.delete_rule
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.referential_constraints AS rc
            ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
        ORDER BY tc.table_name;
    """)
    schema["foreign_keys"] = [
        {
            "from_table": row[0],
            "from_column": row[1],
            "to_table": row[2],
            "to_column": row[3],
            "delete_rule": row[4]
        }
        for row in cur.fetchall()
    ]

    # RLS  
    cur.execute("""
        SELECT tablename, COUNT(*) FROM pg_policies
        WHERE schemaname = 'public'
        GROUP BY tablename;
    """)
    schema["rls_policies"] = {row[0]: row[1] for row in cur.fetchall()}

    # Storage 
    cur.execute("""
        SELECT name, public, file_size_limit
        FROM storage.buckets
        ORDER BY name;
    """)
    schema["storage_buckets"] = [
        {
            "name": row[0],
            "public": row[1],
            "file_size_limit_mb": row[2] / (1024*1024) if row[2] else None
        }
        for row in cur.fetchall()
    ]

    cur.close()
    conn.close()

    # JSON 
    output_path = project_root / "scripts" / "supabase_schema.json"
    output_path.parent.mkdir(exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)

    print(f"[OK]   : {output_path}")
    print(f"  - v2 : {len(schema['v2_tables'])}")
    print(f"  -  : {len(schema['chat_tables'])}")
    print(f"  - Foreign Keys: {len(schema['foreign_keys'])}")
    print(f"  - RLS : {sum(schema['rls_policies'].values())}")
    print(f"  - Storage : {len(schema['storage_buckets'])}")


if __name__ == "__main__":
    print("\n[INFO] ZipCheck v2 Supabase Schema Inspection")
    print(f"DATABASE_URL: {DATABASE_URL[:50]}..." if DATABASE_URL else "[ERROR]  ")
    print(f"SUPABASE_URL: {SUPABASE_URL}" if SUPABASE_URL else "[ERROR]  ")

    inspect_database_schema()
    inspect_storage_buckets()
    save_schema_json()

    print("\n" + "=" * 80)
    print("[DONE] Inspection Complete!")
    print("=" * 80)
