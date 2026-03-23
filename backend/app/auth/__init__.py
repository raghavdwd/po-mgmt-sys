from datetime import datetime, timedelta, timezone

from joserfc import jwt
from joserfc.jwk import OctKey
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.user import User

settings = get_settings()
security = HTTPBearer(auto_error=False)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    )
    payload["exp"] = int(expire.timestamp())
    payload["iat"] = int(datetime.now(timezone.utc).timestamp())

    key = OctKey.import_key(settings.JWT_SECRET_KEY)
    token = jwt.encode({"alg": settings.JWT_ALGORITHM}, payload, key)
    return token


def verify_access_token(token: str) -> dict:
    try:
        key = OctKey.import_key(settings.JWT_SECRET_KEY)
        decoded = jwt.decode(token, key)
        claims = decoded.claims

        now = int(datetime.now(timezone.utc).timestamp())
        if claims.get("exp", 0) < now:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired",
            )
        return claims
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    claims = verify_access_token(credentials.credentials)
    user_id = claims.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = await db.get(User, int(user_id))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user
