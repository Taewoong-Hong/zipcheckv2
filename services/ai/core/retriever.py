"""Vector store and retriever configuration."""
from langchain_community.vectorstores.pgvector import PGVector
from langchain_core.vectorstores import VectorStoreRetriever
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from .embeddings import get_embedder
from .settings import settings


def get_pg_connection() -> Engine:
    """
    Create PostgreSQL connection engine with optimized pool settings.

    Returns:
        SQLAlchemy engine connected to Supabase Postgres

    Note:
        Connection pool settings:
        - pool_size=5: Base connections
        - max_overflow=5: Additional connections during peak
        - pool_pre_ping=True: Verify connections before use
        - prepare_threshold=0: Disable prepared statements (required for Supabase connection pooler)
    """
    return create_engine(
        settings.database_url,
        pool_pre_ping=True,  # Test connections before use
        pool_size=5,  # Base pool size
        max_overflow=5  # Max overflow connections
    )


def get_vectorstore(collection_name: str = "v2_contract_docs") -> PGVector:
    """
    Get or create a PGVector vectorstore instance.

    Args:
        collection_name: Name of the vector collection/table

    Returns:
        Configured PGVector instance

    Note:
        Requires pgvector extension to be enabled in Postgres:
        CREATE EXTENSION IF NOT EXISTS vector;
    """
    engine = get_pg_connection()
    embeddings = get_embedder()

    return PGVector(
        connection=engine,
        collection_name=collection_name,
        embedding_function=embeddings,
        # PGVector will create tables if they don't exist
        # Table schema: id, collection_id, embedding (vector), document, cmetadata
    )


def get_retriever(
    k: int = 6,
    collection_name: str = "v2_contract_docs",
    search_type: str = "similarity",
) -> VectorStoreRetriever:
    """
    Get a configured retriever for vector search.

    Args:
        k: Number of top results to retrieve
        collection_name: Vector collection name
        search_type: Type of search ("similarity", "mmr", "similarity_score_threshold")

    Returns:
        Configured retriever instance

    Note:
        For production, consider tuning:
        - k: Number of results (6-10 recommended for contract analysis)
        - search_type: "mmr" for diverse results, "similarity" for most relevant
        - score_threshold: Filter by similarity score if using similarity_score_threshold
    """
    vectorstore = get_vectorstore(collection_name=collection_name)

    return vectorstore.as_retriever(
        search_type=search_type,
        search_kwargs={"k": k},
    )
