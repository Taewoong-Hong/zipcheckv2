"""Embeddings configuration and factory."""
from langchain_openai import OpenAIEmbeddings
from langchain_core.embeddings import Embeddings

from .settings import settings


def get_embedder() -> Embeddings:
    """
    Get configured embeddings instance.

    Returns:
        Configured embeddings model

    Note:
        Currently uses OpenAI embeddings. Can be extended to support
        other providers (nomic, bge, etc.) based on settings.
    """
    return OpenAIEmbeddings(
        model=settings.embed_model,
        api_key=settings.openai_api_key,
    )


def get_embedding_dimension() -> int:
    """
    Get the dimension of the embedding model.

    Returns:
        Embedding dimension size

    Note:
        text-embedding-3-large: 3072 dimensions
        text-embedding-3-small: 1536 dimensions
        text-embedding-ada-002: 1536 dimensions
    """
    model_dimensions = {
        "text-embedding-3-large": 3072,
        "text-embedding-3-small": 1536,
        "text-embedding-ada-002": 1536,
    }
    return model_dimensions.get(settings.embed_model, 1536)
