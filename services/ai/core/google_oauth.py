"""Google OAuth 2.0 client for ZipCheck authentication."""
import httpx
from typing import Dict, Any, Optional
from urllib.parse import urlencode
from .settings import settings


class GoogleOAuthClient:
    """Google OAuth 2.0 authentication client.

    Flow:
    1. Frontend redirects user to get_authorization_url()
    2. User logs in with Google
    3. Google redirects to GOOGLE_REDIRECT_URI with code
    4. Frontend calls exchange_code_for_tokens(code)
    5. Returns user info + tokens
    """

    GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
    GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

    def __init__(self):
        self.client_id = settings.google_client_id
        self.client_secret = settings.google_client_secret
        self.redirect_uri = settings.google_redirect_uri

    def get_authorization_url(self, state: Optional[str] = None) -> str:
        """Generate Google OAuth authorization URL.

        Args:
            state: CSRF protection token (optional but recommended)

        Returns:
            Full authorization URL to redirect user to

        Example:
            >>> client = GoogleOAuthClient()
            >>> url = client.get_authorization_url(state="random_csrf_token")
            >>> # Redirect user to this URL in browser
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join([
                "openid",
                "email",
                "profile",
            ]),
            "access_type": "offline",  # Get refresh token
            "prompt": "consent",  # Force consent screen to get refresh token
        }

        if state:
            params["state"] = state

        return f"{self.GOOGLE_AUTH_URL}?{urlencode(params)}"

    async def exchange_code_for_tokens(self, code: str) -> Dict[str, Any]:
        """Exchange authorization code for access token and user info.

        Args:
            code: Authorization code from Google redirect

        Returns:
            Dict containing:
                - access_token: OAuth access token
                - refresh_token: OAuth refresh token (if available)
                - id_token: JWT token with user info
                - expires_in: Token expiration time in seconds

        Raises:
            httpx.HTTPStatusError: If token exchange fails
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                self.GOOGLE_TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": self.redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            return response.json()

    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """Fetch user information from Google.

        Args:
            access_token: OAuth access token from exchange_code_for_tokens()

        Returns:
            Dict containing:
                - id: Google user ID
                - email: User email
                - verified_email: Email verification status
                - name: Full name
                - given_name: First name
                - family_name: Last name
                - picture: Profile picture URL
                - locale: User locale (e.g., "ko", "en")

        Raises:
            httpx.HTTPStatusError: If user info fetch fails
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.GOOGLE_USERINFO_URL,
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
                self.GOOGLE_TOKEN_URL,
                data={
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            return response.json()

    async def authenticate(self, code: str) -> Dict[str, Any]:
        """Complete authentication flow: exchange code and fetch user info.

        This is a convenience method that combines:
        1. exchange_code_for_tokens()
        2. get_user_info()

        Args:
            code: Authorization code from Google redirect

        Returns:
            Dict containing:
                - user: User information dict
                - tokens: OAuth tokens dict

        Example:
            >>> client = GoogleOAuthClient()
            >>> result = await client.authenticate(code="4/0AX4XfWh...")
            >>> user_email = result["user"]["email"]
            >>> access_token = result["tokens"]["access_token"]
        """
        # Step 1: Exchange code for tokens
        tokens = await self.exchange_code_for_tokens(code)

        # Step 2: Fetch user info
        user_info = await self.get_user_info(tokens["access_token"])

        return {
            "user": user_info,
            "tokens": tokens,
        }
