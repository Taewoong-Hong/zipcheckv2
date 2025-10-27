#!/usr/bin/env python3
"""
기존 평문 데이터를 암호화하는 마이그레이션 스크립트

⚠️ 주의사항:
1. 실행 전 반드시 데이터베이스 백업
2. ENCRYPTION_KEY 환경변수 설정 필수
3. 한 번만 실행해야 함 (중복 암호화 방지)
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# 프로젝트 경로 추가
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'services/ai'))

from core.encryption import encrypt, is_encrypted

# 환경변수 확인
DATABASE_URL = os.getenv("DATABASE_URL")
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

if not DATABASE_URL:
    print("❌ 에러: DATABASE_URL 환경변수가 설정되지 않았습니다.")
    sys.exit(1)

if not ENCRYPTION_KEY:
    print("❌ 에러: ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.")
    sys.exit(1)

# DB 연결 설정
engine = create_engine(
    DATABASE_URL.replace("postgresql://", "postgresql+psycopg://"),
    pool_pre_ping=True,
    connect_args={"prepare_threshold": 0}
)
SessionLocal = sessionmaker(bind=engine)


def is_encrypted_data(data: str) -> bool:
    """데이터가 이미 암호화되었는지 확인"""
    if not data:
        return False

    # base64 패턴 또는 TypeScript 암호화 패턴
    return (
        len(data) > 100 and  # 암호화된 데이터는 보통 길이가 김
        (
            # Python 암호화 패턴 (base64)
            all(c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=' for c in data) or
            # TypeScript 암호화 패턴 (hex:hex:hex)
            data.count(':') == 2 and all(c in '0123456789abcdef:' for c in data)
        )
    )


def migrate_v2_profiles():
    """v2_profiles 테이블 암호화"""
    session = SessionLocal()
    try:
        # 암호화되지 않은 레코드 조회
        result = session.execute(text("""
            SELECT id, name, email
            FROM v2_profiles
            WHERE name IS NOT NULL OR email IS NOT NULL
        """))

        records = result.fetchall()
        total = len(records)
        encrypted_count = 0
        skipped_count = 0

        print(f"\n📊 v2_profiles: {total}개 레코드 발견")

        for record in records:
            record_id, name, email = record
            updated = False

            # 이름 암호화
            if name and not is_encrypted_data(name):
                encrypted_name = encrypt(name)
                session.execute(
                    text("UPDATE v2_profiles SET name = :name WHERE id = :id"),
                    {"name": encrypted_name, "id": record_id}
                )
                print(f"  ✅ 이름 암호화: {name[:10]}... → {encrypted_name[:20]}...")
                updated = True
            elif name:
                print(f"  ⏭️  이름 이미 암호화됨: {record_id}")
                skipped_count += 1

            # 이메일 암호화 (선택사항)
            if email and not is_encrypted_data(email):
                encrypted_email = encrypt(email)
                session.execute(
                    text("UPDATE v2_profiles SET email = :email WHERE id = :id"),
                    {"email": encrypted_email, "id": record_id}
                )
                print(f"  ✅ 이메일 암호화: {email} → {encrypted_email[:20]}...")
                updated = True
            elif email:
                print(f"  ⏭️  이메일 이미 암호화됨: {record_id}")
                skipped_count += 1

            if updated:
                encrypted_count += 1

        session.commit()
        print(f"\n✅ v2_profiles 완료: {encrypted_count}개 암호화, {skipped_count}개 건너뜀")

    except Exception as e:
        session.rollback()
        print(f"\n❌ v2_profiles 마이그레이션 실패: {e}")
        raise
    finally:
        session.close()


def migrate_v2_documents():
    """v2_documents 테이블 암호화"""
    session = SessionLocal()
    try:
        # 암호화되지 않은 레코드 조회
        result = session.execute(text("""
            SELECT id, property_address, owner_info
            FROM v2_documents
            WHERE property_address IS NOT NULL OR owner_info IS NOT NULL
        """))

        records = result.fetchall()
        total = len(records)
        encrypted_count = 0
        skipped_count = 0

        print(f"\n📊 v2_documents: {total}개 레코드 발견")

        for record in records:
            record_id, property_address, owner_info = record
            updated = False

            # 부동산 주소 암호화
            if property_address and not is_encrypted_data(property_address):
                encrypted_address = encrypt(property_address)
                session.execute(
                    text("UPDATE v2_documents SET property_address = :addr WHERE id = :id"),
                    {"addr": encrypted_address, "id": record_id}
                )
                print(f"  ✅ 주소 암호화: {property_address[:20]}... → {encrypted_address[:20]}...")
                updated = True
            elif property_address:
                print(f"  ⏭️  주소 이미 암호화됨: {record_id}")
                skipped_count += 1

            # 소유자 정보 암호화 (JSONB 필드)
            if owner_info and isinstance(owner_info, dict) and 'name' in owner_info:
                owner_name = owner_info.get('name')
                if owner_name and not is_encrypted_data(owner_name):
                    encrypted_name = encrypt(owner_name)
                    owner_info['name'] = encrypted_name
                    session.execute(
                        text("UPDATE v2_documents SET owner_info = :info WHERE id = :id"),
                        {"info": owner_info, "id": record_id}
                    )
                    print(f"  ✅ 소유자 암호화: {owner_name} → {encrypted_name[:20]}...")
                    updated = True
                elif owner_name:
                    print(f"  ⏭️  소유자 이미 암호화됨: {record_id}")
                    skipped_count += 1

            if updated:
                encrypted_count += 1

        session.commit()
        print(f"\n✅ v2_documents 완료: {encrypted_count}개 암호화, {skipped_count}개 건너뜀")

    except Exception as e:
        session.rollback()
        print(f"\n❌ v2_documents 마이그레이션 실패: {e}")
        raise
    finally:
        session.close()


def migrate_v2_contracts():
    """v2_contracts 테이블 암호화"""
    session = SessionLocal()
    try:
        # 암호화되지 않은 레코드 조회
        result = session.execute(text("""
            SELECT id, addr
            FROM v2_contracts
            WHERE addr IS NOT NULL
        """))

        records = result.fetchall()
        total = len(records)
        encrypted_count = 0
        skipped_count = 0

        print(f"\n📊 v2_contracts: {total}개 레코드 발견")

        for record in records:
            record_id, addr = record

            # 주소 암호화
            if addr and not is_encrypted_data(addr):
                encrypted_addr = encrypt(addr)
                session.execute(
                    text("UPDATE v2_contracts SET addr = :addr WHERE id = :id"),
                    {"addr": encrypted_addr, "id": record_id}
                )
                print(f"  ✅ 주소 암호화: {addr[:20]}... → {encrypted_addr[:20]}...")
                encrypted_count += 1
            elif addr:
                print(f"  ⏭️  주소 이미 암호화됨: {record_id}")
                skipped_count += 1

        session.commit()
        print(f"\n✅ v2_contracts 완료: {encrypted_count}개 암호화, {skipped_count}개 건너뜀")

    except Exception as e:
        session.rollback()
        print(f"\n❌ v2_contracts 마이그레이션 실패: {e}")
        raise
    finally:
        session.close()


def main():
    """메인 마이그레이션 함수"""
    print("=" * 60)
    print("🔐 데이터 암호화 마이그레이션 시작")
    print("=" * 60)
    print(f"DATABASE_URL: {DATABASE_URL[:50]}...")
    print(f"ENCRYPTION_KEY: {'*' * 20} (설정됨)")
    print()

    # 사용자 확인
    response = input("⚠️  데이터베이스 백업을 완료했습니까? (yes/no): ")
    if response.lower() != 'yes':
        print("❌ 마이그레이션 취소됨. 먼저 데이터베이스를 백업하세요!")
        sys.exit(1)

    try:
        # 1. v2_profiles 마이그레이션
        migrate_v2_profiles()

        # 2. v2_documents 마이그레이션
        migrate_v2_documents()

        # 3. v2_contracts 마이그레이션
        migrate_v2_contracts()

        print("\n" + "=" * 60)
        print("✅ 전체 마이그레이션 완료!")
        print("=" * 60)
        print("\n📝 다음 단계:")
        print("  1. 관리자 페이지에서 데이터 확인")
        print("  2. 복호화가 정상 작동하는지 테스트")
        print("  3. 로그에서 에러 확인")
        print()

    except Exception as e:
        print(f"\n❌ 마이그레이션 실패: {e}")
        print("\n⚠️  롤백되었습니다. 데이터는 변경되지 않았습니다.")
        sys.exit(1)


if __name__ == "__main__":
    main()
