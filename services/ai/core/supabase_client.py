"""Supabase client for ZipCheck backend integration."""
import httpx
from typing import Dict, Any, Optional
import time
import logging

from supabase import Client, create_client

from .settings import settings

logger = logging.getLogger(__name__)


class SupabaseAuthClient:
    """Supabase authentication client for backend operations.

    This client is for server-side auth operations only.
    Frontend should use @supabase/supabase-js directly.
    """

    def __init__(self):
        self.url = settings.supabase_url
        self.anon_key = settings.supabase_anon_key
        self.service_role_key = settings.supabase_service_role_key

    @property
    def auth_url(self) -> str:
        """Supabase Auth API base URL."""
        return f"{self.url}/auth/v1"

    async def _retry_request(self, method: str, url: str, max_retries: int = 3, **kwargs):
        """Retry HTTP requests with exponential backoff for 503 errors.

        Args:
            method: HTTP method (get, post, etc.)
            url: Request URL
            max_retries: Maximum number of retry attempts
            **kwargs: Additional httpx request parameters

        Returns:
            httpx.Response object

        Raises:
            httpx.HTTPStatusError: If all retries fail
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            for attempt in range(max_retries):
                try:
                    response = await getattr(client, method)(url, **kwargs)
                    response.raise_for_status()
                    return response
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 503 and attempt < max_retries - 1:
                        wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                        logger.warning(
                            f"Supabase 503 error (attempt {attempt + 1}/{max_retries}). "
                            f"Retrying in {wait_time}s..."
                        )
                        time.sleep(wait_time)
                        continue
                    raise

    async def create_or_update_user(
        self,
        email: str,
        user_metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Create or update user in Supabase Auth.

        This uses service_role_key to bypass RLS and create users server-side.
        Should only be called from backend after OAuth verification.

        Args:
            email: User email from OAuth provider
            user_metadata: Additional user data (name, picture, etc.)

        Returns:
            User object from Supabase

        Raises:
            httpx.HTTPStatusError: If user creation fails
        """
        response = await self._retry_request(
            "post",
            f"{self.auth_url}/admin/users",
            json={
                "email": email,
                "email_confirm": True,  # Auto-confirm OAuth emails
                "user_metadata": user_metadata or {},
            },
            headers={
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
                "Content-Type": "application/json",
            },
        )
        return response.json()

    async def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email using admin API.

        Args:
            email: User email to search

        Returns:
            User object if found, None otherwise
        """
        response = await self._retry_request(
            "get",
            f"{self.auth_url}/admin/users",
            params={"filter": f"email.eq.{email}"},
            headers={
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
            },
        )
        users = response.json().get("users", [])
        return users[0] if users else None

    async def generate_link_token(self, user_id: str) -> Dict[str, Any]:
        """Generate magic link token for user.

        This can be used to create a session token for frontend.

        Args:
            user_id: Supabase user ID

        Returns:
            Dict with access_token and refresh_token
        """
        response = await self._retry_request(
            "post",
            f"{self.auth_url}/admin/generate_link",
            json={
                "type": "magiclink",
                "email": "",  # Will be inferred from user_id
                "user_id": user_id,
            },
            headers={
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
                "Content-Type": "application/json",
            },
        )
        return response.json()

    async def sign_in_with_oauth(
        self,
        provider: str,
        code: str,
    ) -> Dict[str, Any]:
        """Sign in user with OAuth code.

        This exchanges OAuth code for Supabase session.
        Typically used after Google/Kakao OAuth callback.

        Args:
            provider: OAuth provider name (e.g., "google", "kakao")
            code: Authorization code from provider

        Returns:
            Session object with access_token, refresh_token, user

        Note:
            This method is typically NOT needed if you're using
            Supabase client-side OAuth flow (redirect to supabase.co/auth/v1/callback).
            Only use this for custom server-side OAuth flows.
        """
        response = await self._retry_request(
            "post",
            f"{self.auth_url}/token",
            params={"grant_type": "authorization_code"},
            json={
                "auth_code": code,
                "provider": provider,
            },
            headers={
                "apikey": self.anon_key,
                "Content-Type": "application/json",
            },
        )
        return response.json()


class SupabaseStorageClient:
    """Supabase Storage client for file uploads."""

    def __init__(self):
        self.url = settings.supabase_url
        self.service_role_key = settings.supabase_service_role_key

    @property
    def storage_url(self) -> str:
        """Supabase Storage API base URL."""
        return f"{self.url}/storage/v1"

    async def _retry_request(self, method: str, url: str, max_retries: int = 3, **kwargs):
        """Retry HTTP requests with exponential backoff for 503 errors.

        Args:
            method: HTTP method (get, post, delete, etc.)
            url: Request URL
            max_retries: Maximum number of retry attempts
            **kwargs: Additional httpx request parameters

        Returns:
            httpx.Response object

        Raises:
            httpx.HTTPStatusError: If all retries fail
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            for attempt in range(max_retries):
                try:
                    response = await getattr(client, method)(url, **kwargs)
                    response.raise_for_status()
                    return response
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 503 and attempt < max_retries - 1:
                        wait_time = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s
                        logger.warning(
                            f"Supabase Storage 503 error (attempt {attempt + 1}/{max_retries}). "
                            f"Retrying in {wait_time}s..."
                        )
                        time.sleep(wait_time)
                        continue
                    raise

    async def upload_file(
        self,
        bucket: str,
        path: str,
        file_data: bytes,
        content_type: str = "application/pdf",
    ) -> Dict[str, Any]:
        """Upload file to Supabase Storage.

        Args:
            bucket: Storage bucket name (e.g., "contracts")
            path: File path in bucket (e.g., "user_id/contract_id.pdf")
            file_data: File binary data
            content_type: MIME type of file

        Returns:
            Dict with file path and public URL

        Raises:
            httpx.HTTPStatusError: If upload fails
        """
        response = await self._retry_request(
            "post",
            f"{self.storage_url}/object/{bucket}/{path}",
            content=file_data,
            headers={
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
                "Content-Type": content_type,
            },
        )
        return response.json()

    async def get_public_url(self, bucket: str, path: str) -> str:
        """Get public URL for uploaded file.

        Args:
            bucket: Storage bucket name
            path: File path in bucket

        Returns:
            Public URL string
        """
        return f"{self.storage_url}/object/public/{bucket}/{path}"

    async def delete_file(self, bucket: str, path: str) -> Dict[str, Any]:
        """Delete file from Supabase Storage.

        Args:
            bucket: Storage bucket name
            path: File path in bucket

        Returns:
            Success response dict
        """
        response = await self._retry_request(
            "delete",
            f"{self.storage_url}/object/{bucket}/{path}",
            headers={
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
            },
        )
        return response.json()

    async def get_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        """Generate a signed URL for a private object.

        Args:
            bucket: Storage bucket name
            path: Object path in bucket
            expires_in: Expiry in seconds (default: 1 hour)

        Returns:
            Signed URL string
        """
        resp = await self._retry_request(
            "post",
            f"{self.storage_url}/object/sign/{bucket}/{path}",
            json={"expiresIn": expires_in},
            headers={
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
                "Content-Type": "application/json",
            },
        )
        data = resp.json()
        # Response includes 'signedURL' or 'signedUrl' depending on versions
        url = data.get("signedURL") or data.get("signedUrl")
        if not url:
            # Some deployments return 'url'
            url = data.get("url")
        if not url:
            raise ValueError("Failed to generate signed URL")
        # If returned URL is relative, prefix host
        if url.startswith("/"):
            return f"{self.storage_url}{url}"
        return url


# Singleton instances
supabase_auth = SupabaseAuthClient()
supabase_storage = SupabaseStorageClient()


# 🔧 New: Supabase Python SDK client (싱글톤 패턴)
_service_role_client: Client | None = None
_anon_client: Client | None = None


def _create_supabase_client(key: str) -> Client:
    """Create a Supabase client with the given key."""
    if not settings.supabase_url:
        raise ValueError("SUPABASE_URL environment variable is required")
    return create_client(settings.supabase_url, key)


def get_supabase_client(service_role: bool = False) -> Client:
    """Return a cached Supabase client.

    ⚠️ BREAKING CHANGE: Now returns official supabase-py Client, not dict.

    Args:
        service_role: If True, return a client initialized with the service role key.

    Returns:
        Supabase Python client instance.

    Raises:
        ValueError: If the required Supabase credentials are not configured.

    Example:
        >>> supabase = get_supabase_client(service_role=True)
        >>> result = supabase.table("conversations").insert({"user_id": "123"}).execute()
    """

    global _service_role_client, _anon_client

    if service_role:
        if _service_role_client is None:
            if not settings.supabase_service_role_key:
                raise ValueError(
                    "SUPABASE_SERVICE_ROLE_KEY environment variable is required"
                )
            _service_role_client = _create_supabase_client(
                settings.supabase_service_role_key
            )
        return _service_role_client

    # Prefer anon key for non-privileged access when available
    if settings.supabase_anon_key:
        if _anon_client is None:
            _anon_client = _create_supabase_client(settings.supabase_anon_key)
        return _anon_client

    # Fallback to service role client when anon key is not configured
    if _service_role_client is None:
        if not settings.supabase_service_role_key:
            raise ValueError(
                "SUPABASE_SERVICE_ROLE_KEY environment variable is required"
            )
        _service_role_client = _create_supabase_client(settings.supabase_service_role_key)
    return _service_role_client
