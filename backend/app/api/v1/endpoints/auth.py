from datetime import datetime, timezone
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
import jwt

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.logging import logger
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.db.session import get_async_db
from app.models.user import User, RefreshToken
from app.schemas.auth import (
    GoogleAuthRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
)
from app.schemas.user import UserResponse, UserUpdateRequest

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(req: UserRegisterRequest, db: AsyncSession = Depends(get_async_db)):
    """Registers a new user and returns access and refresh tokens."""
    # Check if user with this email already exists
    stmt = select(User).where(User.email == req.email.lower().strip())
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists.",
        )

    user = User(
        id=str(uuid.uuid4()),
        email=req.email.lower().strip(),
        hashed_password=get_password_hash(req.password),
        full_name=req.full_name.strip(),
        role="user",
        is_active=True,
        auth_provider="local",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    # Store refresh token record in DB
    payload = decode_token(refresh_token)
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    token_record = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=exp,
    )
    db.add(token_record)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: UserLoginRequest, db: AsyncSession = Depends(get_async_db)):
    """Authenticates user with email and password and returns new tokens."""
    stmt = select(User).where(User.email == req.email.lower().strip())
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user or not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User account is deactivated.",
        )

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    payload = decode_token(refresh_token)
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    token_record = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=exp,
    )
    db.add(token_record)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token_endpoint(req: RefreshTokenRequest, db: AsyncSession = Depends(get_async_db)):
    """Exchanges a valid refresh token for a new access token and refresh token."""
    try:
        payload = decode_token(req.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type.")
        user_id = payload.get("sub")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has expired.")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")

    # Check database revocation status
    stmt = select(RefreshToken).where(
        RefreshToken.token == req.refresh_token,
        RefreshToken.is_revoked == False,
    )
    token_record = (await db.execute(stmt)).scalar_one_or_none()
    if not token_record:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Revoked or unrecognized token.")

    # Revoke old refresh token (token rotation)
    token_record.is_revoked = True

    # Fetch user
    user = (await db.execute(select(User).where(User.id == str(user_id)))).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive.")

    new_access_token = create_access_token(user.id)
    new_refresh_token = create_refresh_token(user.id)

    new_payload = decode_token(new_refresh_token)
    new_exp = datetime.fromtimestamp(new_payload["exp"], tz=timezone.utc)
    new_token_record = RefreshToken(
        user_id=user.id,
        token=new_refresh_token,
        expires_at=new_exp,
    )
    db.add(new_token_record)
    await db.commit()

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.post("/google", response_model=TokenResponse)
async def google_login(req: GoogleAuthRequest, db: AsyncSession = Depends(get_async_db)):
    """Verifies Google OAuth ID token and logs in or registers user."""
    # Verify Google token via Google's tokeninfo API
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": req.token},
            )
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid or expired Google OAuth token.",
                )
            info = resp.json()
    except httpx.RequestError as e:
        logger.error(f"Google token verification network error: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to reach Google OAuth service.",
        )

    email = info.get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google token missing email claim.")

    # Validate audience matches our Google Client ID if configured
    aud = info.get("aud")
    if settings.GOOGLE_CLIENT_ID and aud and aud != settings.GOOGLE_CLIENT_ID:
        logger.warning(f"Google token aud mismatch: expected {settings.GOOGLE_CLIENT_ID}, got {aud}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google token audience mismatch.")

    email = email.lower().strip()
    full_name = info.get("name") or email.split("@")[0]
    picture = info.get("picture")

    # Find or create user
    stmt = select(User).where(User.email == email)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user:
        user = User(
            id=str(uuid.uuid4()),
            email=email,
            full_name=full_name,
            avatar_url=picture,
            role="user",
            is_active=True,
            auth_provider="google",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        if picture and not user.avatar_url:
            user.avatar_url = picture
            await db.commit()

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)

    payload = decode_token(refresh_token)
    exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
    token_record = RefreshToken(
        user_id=user.id,
        token=refresh_token,
        expires_at=exp,
    )
    db.add(token_record)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Returns profile for current authenticated user."""
    return UserResponse.model_validate(current_user)


@router.patch("/me", response_model=UserResponse)
async def update_me(
    req: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Updates profile for current authenticated user."""
    if req.full_name is not None:
        current_user.full_name = req.full_name.strip()
    if req.avatar_url is not None:
        current_user.avatar_url = req.avatar_url.strip()

    await db.commit()
    await db.refresh(current_user)
    return UserResponse.model_validate(current_user)


@router.post("/logout")
async def logout(
    req: RefreshTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_db),
):
    """Revokes the user's refresh token."""
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token == req.refresh_token, RefreshToken.user_id == current_user.id)
        .values(is_revoked=True)
    )
    await db.commit()
    return {"message": "Successfully logged out."}
