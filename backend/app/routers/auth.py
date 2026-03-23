from fastapi import APIRouter, Request, Depends, HTTPException, status
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.auth import create_access_token, get_current_user
from app.auth.oauth import oauth
from app.schemas.auth import UserResponse, TokenResponse
from app.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.get("/login/google")
async def login_google(request: Request):
    redirect_uri = str(request.url_for("auth_google_callback"))
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/callback/google", name="auth_google_callback")
async def auth_google_callback(request: Request, db: AsyncSession = Depends(get_db)):
    try:
        token = await oauth.google.authorize_access_token(request)
    except Exception as e:
        import logging

        logging.error(f"Google Auth Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google authentication failed: {str(e)}",
        )

    userinfo = token.get("userinfo")
    if not userinfo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not retrieve user info from Google",
        )

    google_id = userinfo["sub"]
    email = userinfo["email"]
    name = userinfo.get("name", email)
    picture = userinfo.get("picture")

    result = await db.execute(select(User).where(User.google_id == google_id))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            email=email,
            name=name,
            google_id=google_id,
            picture_url=picture,
            role=UserRole.USER,
        )
        db.add(user)
        await db.flush()
        await db.refresh(user)

    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": user.role.value}
    )

    import json
    import urllib.parse

    user_dict = {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "picture_url": user.picture_url or "",
        "role": user.role.value,
    }
    user_json = urllib.parse.quote(json.dumps(user_dict))

    frontend_url = settings.FRONTEND_URL
    return HTMLResponse(f"""
    <html><body><script>
        window.opener
            ? window.opener.postMessage({{
                token: "{access_token}",
                user: {json.dumps(user_dict)}
              }}, "{frontend_url}")
            : (window.location.href = "{frontend_url}/?token={access_token}&user={user_json}");
        window.close();
    </script></body></html>
    """)


@router.post("/demo-login", response_model=TokenResponse)
async def demo_login(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.google_id == "demo-google-id-12345")
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=404, detail="Demo user not found. Run seed_data.py first."
        )

    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id, "role": user.role.value}
    )
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=user.id,
            email=user.email,
            name=user.name,
            picture_url=user.picture_url,
            role=user.role.value,
            created_at=user.created_at,
        ),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
