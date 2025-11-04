"""
Supabase Storage artifacts 버킷 존재 여부 확인 스크립트
"""
import os
import sys
import psycopg
from dotenv import load_dotenv

# UTF-8 출력 설정 (Windows CMD 인코딩 문제 해결)
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')

# .env 파일 로드
load_dotenv('services/ai/.env')

DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print("❌ DATABASE_URL 환경변수가 설정되지 않았습니다.")
    exit(1)

try:
    conn = psycopg.connect(DATABASE_URL)
    cur = conn.cursor()

    # 1. artifacts 버킷 존재 여부 확인
    print("=" * 60)
    print("1. artifacts 버킷 존재 여부 확인")
    print("=" * 60)

    cur.execute("""
        SELECT id, name, public, file_size_limit, allowed_mime_types
        FROM storage.buckets
        WHERE id = 'artifacts'
    """)

    bucket = cur.fetchone()

    if bucket:
        print("✅ artifacts 버킷이 존재합니다!")
        print(f"   - ID: {bucket[0]}")
        print(f"   - Name: {bucket[1]}")
        print(f"   - Public: {bucket[2]}")
        print(f"   - Size Limit: {bucket[3]} bytes ({bucket[3] / 1024 / 1024:.1f}MB)")
        print(f"   - Allowed MIME: {bucket[4]}")
    else:
        print("❌ artifacts 버킷이 존재하지 않습니다.")
        print("   마이그레이션 파일을 실행해주세요: supabase/migrations/008_create_artifacts_bucket.sql")

    # 2. artifacts 관련 RLS 정책 확인
    print("\n" + "=" * 60)
    print("2. artifacts RLS 정책 확인")
    print("=" * 60)

    cur.execute("""
        SELECT policyname, permissive, roles, cmd
        FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname LIKE '%artifacts%'
        ORDER BY cmd, policyname
    """)

    policies = cur.fetchall()

    if policies:
        print(f"✅ {len(policies)}개의 RLS 정책이 존재합니다:")
        for p in policies:
            print(f"   - [{p[3]}] {p[0]}")
    else:
        print("❌ artifacts 관련 RLS 정책이 존재하지 않습니다.")
        print("   마이그레이션 파일을 실행해주세요.")

    # 3. artifacts 버킷의 파일 개수 확인
    print("\n" + "=" * 60)
    print("3. artifacts 버킷 파일 개수")
    print("=" * 60)

    cur.execute("""
        SELECT COUNT(*) as file_count,
               SUM(metadata->>'size')::bigint as total_size
        FROM storage.objects
        WHERE bucket_id = 'artifacts'
    """)

    stats = cur.fetchone()

    if stats and stats[0] > 0:
        print(f"✅ {stats[0]}개의 파일이 저장되어 있습니다.")
        if stats[1]:
            total_mb = stats[1] / 1024 / 1024
            print(f"   - 총 용량: {total_mb:.2f}MB")
    else:
        print("📁 파일이 아직 없습니다 (정상 - 아직 업로드 안 됨).")

    # 4. 모든 버킷 목록 확인
    print("\n" + "=" * 60)
    print("4. 전체 버킷 목록")
    print("=" * 60)

    cur.execute("""
        SELECT id, name, public
        FROM storage.buckets
        ORDER BY name
    """)

    all_buckets = cur.fetchall()

    if all_buckets:
        print(f"📦 총 {len(all_buckets)}개의 버킷:")
        for b in all_buckets:
            public_status = "🌐 Public" if b[2] else "🔒 Private"
            print(f"   - {b[0]} ({public_status})")
    else:
        print("❌ 버킷이 하나도 없습니다.")

    cur.close()
    conn.close()

    print("\n" + "=" * 60)
    print("✅ 검사 완료!")
    print("=" * 60)

except Exception as e:
    print(f"❌ 오류 발생: {e}")
    exit(1)
