"""Authentication routes for OAuth providers."""
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
import secrets

from core.google_oauth import GoogleOAuthClient
from core.naver_oauth import NaverOAuthClient
from core.supabase_client import supabase_auth


router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory CSRF token store (use Redis in production)
csrf_tokens = set()


class AuthResponse(BaseModel):
    """Authentication response model."""
    user: dict
    access_token: str
    refresh_token: Optional[str] = None


@router.get("/google/login")
async def google_login():
    """Initiate Google OAuth login flow.

    This generates the Google authorization URL and redirects the user.

    Flow:
    1. User clicks "Login with Google" button
    2. Frontend redirects to this endpoint
    3. This endpoint generates CSRF token and redirects to Google
    4. User logs in with Google
    5. Google redirects back to /auth/google/callback
    """
    # Generate CSRF token
    state = secrets.token_urlsafe(32)
    csrf_tokens.add(state)

    # Generate Google authorization URL
    client = GoogleOAuthClient()
    auth_url = client.get_authorization_url(state=state)

    # Redirect user to Google login
    return RedirectResponse(url=auth_url)


@router.get("/google/callback")
async def google_callback(
    code: str = Query(..., description="Authorization code from Google"),
    state: str = Query(..., description="CSRF protection token"),
):
    """Handle Google OAuth callback.

    This endpoint receives the authorization code from Google,
    exchanges it for tokens, and creates/updates the user in Supabase.

    Args:
        code: Authorization code from Google redirect
        state: CSRF token to verify request authenticity

    Returns:
        RedirectResponse to frontend with session token

    Raises:
        HTTPException: If CSRF validation fails or OAuth exchange fails
    """
    # Validate CSRF token
    if state not in csrf_tokens:
        raise HTTPException(status_code=400, detail="Invalid CSRF token")
    csrf_tokens.remove(state)

    try:
        # Exchange code for tokens and get user info
        client = GoogleOAuthClient()
        result = await client.authenticate(code)

        user_info = result["user"]
        tokens = result["tokens"]

        # Create or update user in Supabase
        supabase_user = await supabase_auth.create_or_update_user(
            email=user_info["email"],
            user_metadata={
                "name": user_info.get("name"),
                "picture": user_info.get("picture"),
                "provider": "google",
                "provider_id": user_info["id"],
            }
        )

        # Generate Supabase session token
        # TODO: Implement proper session token generation
        # For now, redirect to frontend with user info

        # Redirect to frontend with success
        frontend_url = "http://localhost:3000"
        return RedirectResponse(
            url=f"{frontend_url}/auth/callback?success=true&email={user_info['email']}"
        )

    except Exception as e:
        # Redirect to frontend with error
        frontend_url = "http://localhost:3000"
        return RedirectResponse(
            url=f"{frontend_url}/auth/callback?error={str(e)}"
        )


@router.post("/google/exchange")
async def exchange_google_code(code: str):
    """Exchange Google authorization code for user info (API endpoint version).

    This is an alternative to the redirect-based callback flow.
    Use this when frontend handles the OAuth flow with Supabase directly.

    Args:
        code: Authorization code from Google

    Returns:
        AuthResponse with user info and tokens
    """
    try:
        client = GoogleOAuthClient()
        result = await client.authenticate(code)

        user_info = result["user"]
        tokens = result["tokens"]

        # Create or update user in Supabase
        supabase_user = await supabase_auth.create_or_update_user(
            email=user_info["email"],
            user_metadata={
                "name": user_info.get("name"),
                "picture": user_info.get("picture"),
                "provider": "google",
                "provider_id": user_info["id"],
            }
        )

        return AuthResponse(
            user=user_info,
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/naver/exchange")
async def exchange_naver_code(code: str, state: str):
    """Exchange Naver authorization code for user info.

    Args:
        code: Authorization code from Naver
        state: CSRF state token for verification

    Returns:
        AuthResponse with user info and tokens
    """
    try:
        client = NaverOAuthClient()
        result = await client.authenticate(code, state)

        user_info = result["user"]
        tokens = result["tokens"]

        # Create or update user in Supabase
        supabase_user = await supabase_auth.create_or_update_user(
            email=user_info["email"],
            user_metadata={
                "name": user_info.get("name"),
                "nickname": user_info.get("nickname"),
                "profile_image": user_info.get("profile_image"),
                "provider": "naver",
                "provider_id": user_info["id"],
            }
        )

        return AuthResponse(
            user=user_info,
            access_token=tokens["access_token"],
            refresh_token=tokens.get("refresh_token"),
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me")
async def get_current_user():
    """Get current authenticated user.

    This endpoint requires authentication via Authorization header.

    TODO: Implement JWT token validation
    """
    raise HTTPException(
        status_code=501,
        detail="User authentication not yet implemented. Use Supabase client-side auth."
    )
