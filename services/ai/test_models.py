"""데이터베이스 모델 임포트 테스트."""
import sys

print("Testing database models import...")

try:
    from core.database import Profile, Contract, Document, Embedding, Report
    print("[OK] All models imported successfully!")
    print(f"   - Profile: {Profile.__tablename__}")
    print(f"   - Contract: {Contract.__tablename__}")
    print(f"   - Document: {Document.__tablename__}")
    print(f"   - Embedding: {Embedding.__tablename__}")
    print(f"   - Report: {Report.__tablename__}")

    # Check relationships
    print("\nChecking relationships...")
    print(f"   Contract -> documents: {hasattr(Contract, 'documents')}")
    print(f"   Contract -> reports: {hasattr(Contract, 'reports')}")
    print(f"   Document -> contract: {hasattr(Document, 'contract')}")
    print(f"   Document -> embeddings: {hasattr(Document, 'embeddings')}")

    # Check for problematic relationships
    if hasattr(Profile, 'contracts'):
        print("[ERROR] Profile.contracts relationship still exists!")
        sys.exit(1)
    else:
        print("[OK] Profile has no contracts relationship (correct!)")

    if hasattr(Contract, 'user'):
        print("[ERROR] Contract.user relationship still exists!")
        sys.exit(1)
    else:
        print("[OK] Contract has no user relationship (correct!)")

    print("\n[SUCCESS] All model checks passed!")
    sys.exit(0)

except Exception as e:
    print(f"[ERROR] Failed to import models: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
