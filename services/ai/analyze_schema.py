#!/usr/bin/env python3
"""
Supabase 스키마 구조 분석 스크립트

database.py에 정의된 SQLAlchemy 모델들을 분석하여
테이블 구조, 관계, 제약조건 등을 문서화합니다.
"""
import json
from typing import Dict, List, Any
from sqlalchemy import inspect, MetaData
from sqlalchemy.orm import class_mapper
from sqlalchemy.inspection import inspect as sqlalchemy_inspect

# 프로젝트의 모델들을 임포트
from core.database import Base, Profile, Contract, Document, Embedding, Report, get_engine


def analyze_model(model_class) -> Dict[str, Any]:
    """SQLAlchemy 모델 클래스를 분석하여 스키마 정보 추출"""
    mapper = class_mapper(model_class)
    inspector = sqlalchemy_inspect(model_class)
    
    # 기본 정보
    model_info = {
        "table_name": model_class.__tablename__,
        "class_name": model_class.__name__,
        "docstring": model_class.__doc__,
        "columns": {},
        "relationships": {},
        "constraints": []
    }
    
    # 컬럼 정보 추출
    for column in mapper.columns:
        col_info = {
            "type": str(column.type),
            "nullable": column.nullable,
            "primary_key": column.primary_key,
            "foreign_key": None,
            "default": str(column.default.arg) if column.default else None,
            "index": column.index,
            "unique": column.unique
        }
        
        # 외래키 정보
        if column.foreign_keys:
            fk = list(column.foreign_keys)[0]
            col_info["foreign_key"] = {
                "table": fk.column.table.name,
                "column": fk.column.name,
                "ondelete": fk.ondelete
            }
            
        model_info["columns"][column.name] = col_info
    
    # 관계 정보 추출
    for rel_name, rel_prop in mapper.relationships.items():
        rel_info = {
            "target": rel_prop.mapper.class_.__name__,
            "target_table": rel_prop.mapper.class_.__tablename__,
            "type": "one-to-many" if rel_prop.uselist else "one-to-one",
            "back_populates": rel_prop.back_populates,
            "cascade": list(rel_prop.cascade) if rel_prop.cascade else []
        }
        model_info["relationships"][rel_name] = rel_info
    
    # 제약조건 정보
    if hasattr(model_class, "__table_args__"):
        table_args = model_class.__table_args__
        if isinstance(table_args, tuple):
            for arg in table_args:
                if hasattr(arg, "name") and hasattr(arg, "sqltext"):
                    model_info["constraints"].append({
                        "name": arg.name,
                        "check": str(arg.sqltext)
                    })
    
    return model_info


def analyze_schema():
    """전체 스키마 구조 분석"""
    # 분석할 모델들
    models = [Profile, Contract, Document, Embedding, Report]
    
    schema_info = {
        "database": "Supabase (PostgreSQL + pgvector)",
        "models": {},
        "summary": {
            "total_tables": len(models),
            "vector_enabled": False,
            "relationships": []
        }
    }
    
    # 각 모델 분석
    for model in models:
        model_info = analyze_model(model)
        schema_info["models"][model.__name__] = model_info
        
        # 벡터 확장 사용 여부 체크
        for col_name, col_info in model_info["columns"].items():
            if "Vector" in col_info["type"]:
                schema_info["summary"]["vector_enabled"] = True
                
        # 관계 정보 수집
        for rel_name, rel_info in model_info["relationships"].items():
            rel_summary = f"{model.__name__} -> {rel_info['target']} ({rel_info['type']})"
            schema_info["summary"]["relationships"].append(rel_summary)
    
    return schema_info


def print_schema_report(schema_info: Dict[str, Any]):
    """스키마 분석 결과를 읽기 쉬운 형태로 출력"""
    print("=" * 80)
    print("[Database] ZipCheck Supabase Schema Structure Analysis Report")
    print("=" * 80)
    print()
    
    # 요약 정보
    print("[Summary]")
    print(f"  - Total tables: {schema_info['summary']['total_tables']}")
    print(f"  - pgvector enabled: {'Yes' if schema_info['summary']['vector_enabled'] else 'No'}")
    print(f"  - Relationships: {len(schema_info['summary']['relationships'])}")
    print()
    
    # 각 테이블 상세 정보
    for model_name, model_info in schema_info["models"].items():
        print(f"\n{'=' * 60}")
        print(f"[Table] {model_info['table_name']} (Model: {model_name})")
        print(f"   Description: {model_info['docstring']}")
        print(f"\n   Columns ({len(model_info['columns'])}):")
        
        for col_name, col_info in model_info["columns"].items():
            pk = "[PK]" if col_info["primary_key"] else "    "
            fk = "[FK]" if col_info["foreign_key"] else "    "
            idx = "[IDX]" if col_info["index"] else "     "
            null = "NULL" if col_info["nullable"] else "NOT NULL"
            
            print(f"     {pk}{fk}{idx} {col_name}: {col_info['type']} {null}")
            
            if col_info["foreign_key"]:
                fk_info = col_info["foreign_key"]
                print(f"              -> {fk_info['table']}.{fk_info['column']}")
                if fk_info["ondelete"]:
                    print(f"              -> ON DELETE {fk_info['ondelete']}")
            
            if col_info["default"]:
                print(f"              -> DEFAULT: {col_info['default']}")
        
        # 제약조건
        if model_info["constraints"]:
            print(f"\n   Constraints ({len(model_info['constraints'])}):")
            for constraint in model_info["constraints"]:
                print(f"     [CHECK] {constraint['name']}: {constraint['check']}")
        
        # 관계
        if model_info["relationships"]:
            print(f"\n   Relationships ({len(model_info['relationships'])}):")
            for rel_name, rel_info in model_info["relationships"].items():
                cascade = f" CASCADE {','.join(map(str, rel_info['cascade']))}" if rel_info['cascade'] else ""
                print(f"     -> {rel_name}: {rel_info['target']} ({rel_info['type']}){cascade}")
    
    # 전체 관계 다이어그램
    print(f"\n\n{'=' * 60}")
    print("[Relationship Diagram]")
    for rel in schema_info["summary"]["relationships"]:
        print(f"  {rel}")
    
    print("\n" + "=" * 80)
    
    # JSON 파일로도 저장
    with open("schema_analysis.json", "w", encoding="utf-8") as f:
        json.dump(schema_info, f, ensure_ascii=False, indent=2)
    print("\n[File] Detailed analysis saved to 'schema_analysis.json'")


if __name__ == "__main__":
    try:
        # 스키마 분석 실행
        schema_info = analyze_schema()
        
        # 리포트 출력
        print_schema_report(schema_info)
        
        # 추가 분석: 벡터 임베딩 정보
        print("\n\n[Vector Embedding Details]")
        print("  - Embedding dimensions: 1536 (OpenAI text-embedding-3-small)")
        print("  - Vector store: PostgreSQL pgvector extension")
        print("  - Purpose: RAG (Retrieval-Augmented Generation) system")
        print("  - Chunk storage: Documents are split into chunks and vectorized")
        
    except Exception as e:
        # 유니코드 에러 방지를 위해 영문으로 출력
        print(f"Error occurred: {e}")
        import traceback
        traceback.print_exc()