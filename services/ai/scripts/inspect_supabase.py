"""
Supabase 데이터베이스 구조 및 Storage 버킷 전체 파악
"""
import os
import sys
from pathlib import Path

# 프로젝트 루트를 sys.path에 추가
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from dotenv import load_dotenv
import psycopg
from supabase import create_client, Client
import json

# .env 로드
env_path = project_root / ".env"
load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")


def inspect_database_schema():
    """PostgreSQL 데이터베이스 스키마 전체 조회"""
    print("\n" + "=" * 80)
    print("📊 DATABASE SCHEMA INSPECTION")
    print("=" * 80)

    conn = psycopg.connect(DATABASE_URL)
    cur = conn.cursor()

    # 1. v2_ 테이블 목록
    print("\n1️⃣ V2 테이블 목록 (v2_ prefix)")
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
    print(f"총 {len(v2_tables)}개 테이블")
    for row in v2_tables:
        print(f"  - {row[0]} (indexes={row[2]}, rules={row[3]}, triggers={row[4]})")

    # 2. 채팅 관련 테이블
    print("\n2️⃣ 채팅 관련 테이블 (conversations, messages)")
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

    # 3. RLS 활성화 상태
    print("\n3️⃣ RLS (Row Level Security) 활성화 상태")
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
        status = "✅ ON" if row[1] else "❌ OFF"
        print(f"  {row[0]:40} {status}")

    # 4. RLS 정책 상세
    print("\n4️⃣ RLS 정책 개수")
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
    print(f"총 {total_policies}개 정책")
    for row in policies:
        print(f"  {row[1]:40} {row[2]:2}개")

    # 5. Foreign Key 관계
    print("\n5️⃣ Foreign Key 관계")
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
    print(f"총 {len(fks)}개 FK")
    current_table = None
    for row in fks:
        from_table, from_col, to_table, to_col, delete_rule = row
        if from_table != current_table:
            print(f"\n  📋 {from_table}")
            current_table = from_table
        print(f"    → {from_col} ──► {to_table}.{to_col} ({delete_rule})")

    # 6. 인덱스 상세
    print("\n6️⃣ 주요 인덱스")
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
            AND NOT ix.indisprimary  -- PK 제외
        GROUP BY t.tablename, i.indexname
        ORDER BY t.tablename, i.indexname;
    """)

    indexes = cur.fetchall()
    print(f"총 {len(indexes)}개 인덱스 (PK 제외)")
    current_table = None
    for row in indexes:
        table, index_name, columns = row
        if table != current_table:
            print(f"\n  📋 {table}")
            current_table = table
        print(f"    {index_name}: {', '.join(columns)}")

    # 7. 컬럼 상세 (v2_cases, v2_artifacts, v2_reports만)
    print("\n7️⃣ 핵심 테이블 컬럼 상세")
    print("-" * 80)

    for table_name in ['v2_cases', 'v2_artifacts', 'v2_reports']:
        print(f"\n  📋 {table_name}")
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

    # 8. Storage 정보 (storage.buckets)
    print("\n8️⃣ Storage 버킷 정보")
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
    print(f"총 {len(buckets)}개 버킷")
    for row in buckets:
        bucket_id, name, is_public, size_limit, mime_types, created = row
        public_str = "🌐 Public" if is_public else "🔒 Private"
        size_mb = size_limit / (1024 * 1024) if size_limit else "무제한"
        print(f"\n  {name} ({public_str})")
        print(f"    ID: {bucket_id}")
        print(f"    크기 제한: {size_mb}MB" if isinstance(size_mb, str) else f"    크기 제한: {size_mb:.1f}MB")
        print(f"    허용 MIME: {mime_types or '모두'}")
        print(f"    생성일: {created}")

    # 9. Storage RLS 정책
    print("\n9️⃣ Storage RLS 정책")
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
    print(f"총 {storage_policies and len(storage_policies) or 0}개 Storage 정책")
    current_bucket = None
    for row in storage_policies:
        bucket, policy_name, definition = row
        if bucket != current_bucket:
            print(f"\n  🪣 {bucket}")
            current_bucket = bucket
        print(f"    {policy_name}")
        print(f"      {definition[:100]}..." if len(definition) > 100 else f"      {definition}")

    # 10. 통계
    print("\n🔟 데이터베이스 통계")
    print("-" * 80)

    for table_name in ['v2_cases', 'v2_artifacts', 'v2_reports', 'conversations', 'messages']:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table_name};")
            count = cur.fetchone()[0]
            print(f"  {table_name:30} {count:>10,} rows")
        except Exception as e:
            print(f"  {table_name:30} (조회 실패: {e})")

    cur.close()
    conn.close()


def inspect_storage_buckets():
    """Supabase Storage 버킷 구조 파악"""
    print("\n" + "=" * 80)
    print("🪣 STORAGE BUCKET INSPECTION")
    print("=" * 80)

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    # 1. 버킷 목록
    print("\n1️⃣ 버킷 목록")
    print("-" * 80)
    try:
        buckets = supabase.storage.list_buckets()
        print(f"총 {len(buckets)}개 버킷")
        for bucket in buckets:
            print(f"\n  {bucket.name}")
            print(f"    ID: {bucket.id}")
            print(f"    Public: {'🌐 Yes' if bucket.public else '🔒 No'}")
            print(f"    크기 제한: {bucket.file_size_limit / (1024*1024) if bucket.file_size_limit else '무제한'}MB")
            print(f"    허용 MIME: {bucket.allowed_mime_types or '모두'}")
    except Exception as e:
        print(f"버킷 목록 조회 실패: {e}")

    # 2. artifacts 버킷 파일 구조 샘플
    print("\n2️⃣ artifacts 버킷 파일 구조 샘플 (최대 10개)")
    print("-" * 80)
    try:
        files = supabase.storage.from_('artifacts').list(limit=100)

        # 파일 개수 세기
        total_files = len(files) if files else 0
        print(f"최상위 폴더/파일: {total_files}개")

        if files:
            for idx, file in enumerate(files[:10], 1):
                file_name = file.get('name', 'N/A')
                file_id = file.get('id', 'N/A')

                print(f"\n  {idx}. {file_name}")
                print(f"     ID: {file_id}")

                # 폴더면 하위 탐색
                if file.get('metadata') is None or not file.get('metadata', {}).get('size'):
                    try:
                        sub_files = supabase.storage.from_('artifacts').list(file_name, limit=5)
                        if sub_files:
                            print(f"     하위 파일: {len(sub_files)}개")
                            for sub_file in sub_files[:3]:
                                sub_name = sub_file.get('name', 'N/A')
                                print(f"       - {sub_name}")
                    except Exception as e:
                        print(f"     하위 폴더 조회 실패: {e}")
                else:
                    # 파일 메타데이터
                    metadata = file.get('metadata', {})
                    size = metadata.get('size', 0)
                    mime = metadata.get('mimetype', 'N/A')
                    print(f"     크기: {size:,} bytes")
                    print(f"     MIME: {mime}")
    except Exception as e:
        print(f"artifacts 버킷 조회 실패: {e}")


def save_schema_json():
    """스키마를 JSON 파일로 저장 (백업용)"""
    print("\n" + "=" * 80)
    print("💾 스키마 JSON 저장")
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

    # v2 테이블
    cur.execute("""
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'public' AND tablename LIKE 'v2_%'
        ORDER BY tablename;
    """)
    schema["v2_tables"] = [row[0] for row in cur.fetchall()]

    # 채팅 테이블
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

    # RLS 정책 개수
    cur.execute("""
        SELECT tablename, COUNT(*) FROM pg_policies
        WHERE schemaname = 'public'
        GROUP BY tablename;
    """)
    schema["rls_policies"] = {row[0]: row[1] for row in cur.fetchall()}

    # Storage 버킷
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

    # JSON 저장
    output_path = project_root / "scripts" / "supabase_schema.json"
    output_path.parent.mkdir(exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(schema, f, indent=2, ensure_ascii=False)

    print(f"✅ 스키마 저장 완료: {output_path}")
    print(f"  - v2 테이블: {len(schema['v2_tables'])}개")
    print(f"  - 채팅 테이블: {len(schema['chat_tables'])}개")
    print(f"  - Foreign Keys: {len(schema['foreign_keys'])}개")
    print(f"  - RLS 정책: {sum(schema['rls_policies'].values())}개")
    print(f"  - Storage 버킷: {len(schema['storage_buckets'])}개")


if __name__ == "__main__":
    print("\n[INFO] ZipCheck v2 Supabase Schema Inspection")
    print(f"DATABASE_URL: {DATABASE_URL[:50]}..." if DATABASE_URL else "[ERROR] 환경변수 없음")
    print(f"SUPABASE_URL: {SUPABASE_URL}" if SUPABASE_URL else "[ERROR] 환경변수 없음")

    inspect_database_schema()
    inspect_storage_buckets()
    save_schema_json()

    print("\n" + "=" * 80)
    print("[DONE] Inspection Complete!")
    print("=" * 80)
