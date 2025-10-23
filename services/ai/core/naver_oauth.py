"""Naver OAuth 2.0 client for ZipCheck authentication."""
import httpx
from typing import Dict, Any, Optional
from urllib.parse import urlencode
from .settings import settings


class NaverOAuthClient:
    """Naver OAuth 2.0 authentication client.

    Flow:
    1. Frontend redirects user to get_authorization_url()
    2. User logs in with Naver
    3. Naver redirects to NAVER_REDIRECT_URI with code
    4. Frontend calls exchange_code_for_tokens(code)
    5. Returns user info + tokens
    """

    NAVER_AUTH_URL = "https://nid.naver.com/oauth2.0/authorize"
    NAVER_TOKEN_URL = "https://nid.naver.com/oauth2.0/token"
    NAVER_USERINFO_URL = "https://openapi.naver.com/v1/nid/me"

    def __init__(self):
        self.client_id = settings.naver_client_id
        self.client_secret = settings.naver_client_secret
        self.redirect_uri = settings.naver_redirect_uri

    def get_authorization_url(self, state: Optional[str] = None) -> str:
        """Generate Naver OAuth authorization URL.

        Args:
            state: CSRF protection token (required for Naver)

        Returns:
            Full authorization URL to redirect user to

        Example:
            >>> client = NaverOAuthClient()
            >>> url = client.get_authorization_url(state="random_csrf_token")
            >>> # Redirect user to this URL in browser
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
        }

        if state:
            params["state"] = state

        return f"{self.NAVER_AUTH_URL}?{urlencode(params)}"

    async def exchange_code_for_tokens(self, code: str, state: str) -> Dict[str, Any]:
        """Exchange authorization code for access token.

        Args:
            code: Authorization code from Naver redirect
            state: State value from initial request (for verification)

        Returns:
            Dict containing:
                - access_token: OAuth access token
                - refresh_token: OAuth refresh token
                - token_type: Token type (usually "bearer")
                - expires_in: Token expiration time in seconds

        Raises:
            httpx.HTTPStatusError: If token exchange fails
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.NAVER_TOKEN_URL,
                params={
                    "grant_type": "authorization_code",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "state": state,
                },
            )
            response.raise_for_status()
            return response.json()

    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Fetch user information from Naver.

        Args:
            access_token: OAuth access token from exchange_code_for_tokens()

        Returns:
            Dict containing:
                - resultcode: Result code ("00" for success)
                - message: Response message ("success" for success)
                - response: User information dict
                    - id: Naver user ID (unique identifier)
                    - email: User email
                    - name: Full name
                    - nickname: Nickname
                    - profile_image: Profile picture URL
                    - age: Age range (e.g., "20-29")
                    - gender: Gender ("M" or "F")
                    - birthday: Birthday (MM-DD format)
                    - birthyear: Birth year (YYYY format)
                    - mobile: Mobile number (with country code)

        Raises:
            httpx.HTTPStatusError: If user info fetch fails
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.NAVER_USERINFO_URL,
                headers={"Authorization": f"Bearer {access_token}"},
            )
            response.raise_for_status()
            return response.json()

    async def refresh_access_token(self, refresh_token: str) -> Dict[str, Any]:
        """Refresh access token using refresh token.

        Args:
            refresh_token: Refresh token from initial authorization

        Returns:
            Dict containing new access_token and expires_in

        Raises:
            httpx.HTTPStatusError: If token refresh fails
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.NAVER_TOKEN_URL,
                params={
                    "grant_type": "refresh_token",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": refresh_token,
                },
            )
            response.raise_for_status()
            return response.json()

    async def delete_token(self, access_token: str) -> Dict[str, Any]:
        """Delete (invalidate) access token.

        This is used for user logout.

        Args:
            access_token: Access token to delete

        Returns:
            Dict with result code and message

        Raises:
            httpx.HTTPStatusError: If token deletion fails
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.NAVER_TOKEN_URL,
                params={
                    "grant_type": "delete",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "access_token": access_token,
                },
            )
            response.raise_for_status()
            return response.json()

    async def authenticate(self, code: str, state: str) -> Dict[str, Any]:
        """Complete authentication flow: exchange code and fetch user info.

        This is a convenience method that combines:
        1. exchange_code_for_tokens()
        2. get_user_info()

        Args:
            code: Authorization code from Naver redirect
            state: State value for CSRF verification

        Returns:
            Dict containing:
                - user: User information dict
                - tokens: OAuth tokens dict

        Example:
            >>> client = NaverOAuthClient()
            >>> result = await client.authenticate(code="...", state="...")
            >>> user_email = result["user"]["response"]["email"]
            >>> access_token = result["tokens"]["access_token"]
        """
        # Step 1: Exchange code for tokens
        tokens = await self.exchange_code_for_tokens(code, state)

        # Step 2: Fetch user info
        user_info = await self.get_user_info(tokens["access_token"])

        # Check if user info fetch was successful
        if user_info.get("resultcode") != "00":
            raise ValueError(f"Failed to get user info: {user_info.get('message')}")

        return {
            "user": user_info["response"],
            "tokens": tokens,
        }
