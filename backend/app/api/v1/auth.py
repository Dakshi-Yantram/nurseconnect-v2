"""Auth endpoints: OTP send/verify, register, refresh, me."""
import logging
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.integrations import msg91_client
from app.models.enums import UserRole, UserStatus
from app.models.models import ConsumerProfile, OtpCode, User, UserSession, WorkerProfile
from app.schemas.schemas import (
    AuthResponse,
    OtpSendRequest,
    OtpSendResponse,
    OtpVerifyRequest,
    RefreshRequest,
    TokenPair,
    UserOut,
)
from app.services.common_services import audit

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_phone(phone: str) -> str:
    p = phone.strip().replace(" ", "")
    if not p.startswith("+"):
        # Assume India +91 if 10 digits
        if len(p) == 10 and p.isdigit():
            p = f"+91{p}"
        else:
            p = f"+{p}"
    return p


def _issue_token_pair(user: User, claims_extra: dict | None = None) -> TokenPair:
    extras = {"role": user.role.value}
    if claims_extra:
        extras.update(claims_extra)
    access = create_access_token(str(user.id), extras)
    refresh = create_refresh_token(str(user.id), extras)
    return TokenPair(
        access_token=access,
        refresh_token=refresh,
        expires_in=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post("/send-otp", response_model=OtpSendResponse)
async def send_otp(payload: OtpSendRequest, db: AsyncSession = Depends(get_db)):
    phone = _normalize_phone(payload.phone_e164)
    code = settings.OTP_DEV_FIXED_CODE if settings.OTP_DEV_MODE else f"{secrets.randbelow(1000000):06d}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    otp = OtpCode(
        phone_e164=phone,
        code_hash=hash_password(code),
        purpose=payload.purpose,
        expires_at=expires_at,
    )
    db.add(otp)
    await db.commit()

    # Dispatch via provider abstraction (mock in dev)
    await msg91_client.send_otp(phone, code)

    return OtpSendResponse(
        sent=True,
        phone_e164=phone,
        expires_in_seconds=settings.OTP_EXPIRE_MINUTES * 60,
        dev_otp=code if settings.OTP_DEV_MODE else None,
    )


@router.post("/verify-otp", response_model=AuthResponse)
async def verify_otp(payload: OtpVerifyRequest, db: AsyncSession = Depends(get_db)):
    phone = _normalize_phone(payload.phone_e164)
    res = await db.execute(
        select(OtpCode)
        .where(OtpCode.phone_e164 == phone, OtpCode.consumed.is_(False))
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    )
    otp = res.scalar_one_or_none()
    if not otp:
        raise HTTPException(status_code=400, detail="No active OTP. Please request a new one.")
    if otp.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired")
    if otp.attempts >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Request a new OTP.")

    otp.attempts += 1
    if not verify_password(payload.code, otp.code_hash):
        await db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP")

    otp.consumed = True

    # Get or create user
    ures = await db.execute(select(User).where(User.phone_e164 == phone))
    user = ures.scalar_one_or_none()
    is_new = False
    if not user:
        is_new = True
        user = User(
            phone_e164=phone,
            role=payload.role,
            status=UserStatus.active,
        )
        db.add(user)
        await db.flush()

        if payload.role == UserRole.consumer:
            db.add(ConsumerProfile(user_id=user.id))
        elif payload.role == UserRole.worker:
            db.add(WorkerProfile(user_id=user.id))
        await db.flush()
    else:
        if user.status == UserStatus.pending_verification:
            user.status = UserStatus.active
        user.last_login_at = datetime.now(timezone.utc)

    tokens = _issue_token_pair(user)
    # Persist session
    refresh_payload = decode_token(tokens.refresh_token)
    session = UserSession(
        user_id=user.id,
        refresh_token_jti=refresh_payload["jti"],
        device_id=payload.device_id,
        device_platform=payload.device_platform,
        fcm_token=payload.fcm_token,
        expires_at=datetime.fromtimestamp(refresh_payload["exp"], tz=timezone.utc),
    )
    db.add(session)
    await audit(db, user.id, user.role.value, "auth.otp_verify", "user", user.id, {"new": is_new})
    await db.commit()
    await db.refresh(user)

    return AuthResponse(user=UserOut.model_validate(user), tokens=tokens)


@router.post("/login", response_model=AuthResponse)
async def login_direct(payload: OtpVerifyRequest, db: AsyncSession = Depends(get_db)):
    """
    Direct login — OTP step has been removed per product requirement.
    Phone + role are sufficient to mint a session. Existing user models,
    JWT, refresh, and session tables are reused unchanged.
    """
    phone = _normalize_phone(payload.phone_e164)
    # Get-or-create user (same logic as verify-otp, OTP check skipped).
    ures = await db.execute(select(User).where(User.phone_e164 == phone))
    user = ures.scalar_one_or_none()
    is_new = False
    if not user:
        is_new = True
        user = User(phone_e164=phone, role=payload.role, status=UserStatus.active)
        db.add(user)
        await db.flush()
        if payload.role == UserRole.consumer:
            db.add(ConsumerProfile(user_id=user.id))
        elif payload.role == UserRole.worker:
            db.add(WorkerProfile(user_id=user.id))
        await db.flush()
    else:
        if user.status == UserStatus.pending_verification:
            user.status = UserStatus.active
        user.last_login_at = datetime.now(timezone.utc)

    tokens = _issue_token_pair(user)
    refresh_payload = decode_token(tokens.refresh_token)
    db.add(UserSession(
        user_id=user.id,
        refresh_token_jti=refresh_payload["jti"],
        device_id=payload.device_id,
        device_platform=payload.device_platform,
        fcm_token=payload.fcm_token,
        expires_at=datetime.fromtimestamp(refresh_payload["exp"], tz=timezone.utc),
    ))
    await audit(db, user.id, user.role.value, "auth.login_direct", "user", user.id, {"new": is_new})
    await db.commit()
    await db.refresh(user)
    return AuthResponse(user=UserOut.model_validate(user), tokens=tokens)


@router.post("/refresh", response_model=TokenPair)
async def refresh_token(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        claims = decode_token(payload.refresh_token)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    if claims.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Not a refresh token")
    jti = claims.get("jti")
    sres = await db.execute(select(UserSession).where(UserSession.refresh_token_jti == jti))
    session = sres.scalar_one_or_none()
    if not session or session.revoked or session.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired or revoked")

    ures = await db.execute(select(User).where(User.id == session.user_id))
    user = ures.scalar_one()
    tokens = _issue_token_pair(user)
    # Rotate: revoke old, persist new
    session.revoked = True
    new_payload = decode_token(tokens.refresh_token)
    db.add(UserSession(
        user_id=user.id,
        refresh_token_jti=new_payload["jti"],
        device_id=session.device_id,
        device_platform=session.device_platform,
        fcm_token=session.fcm_token,
        expires_at=datetime.fromtimestamp(new_payload["exp"], tz=timezone.utc),
    ))
    await db.commit()
    return tokens


@router.post("/logout")
async def logout(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        claims = decode_token(payload.refresh_token)
        jti = claims.get("jti")
        await db.execute(update(UserSession).where(UserSession.refresh_token_jti == jti).values(revoked=True))
        await db.commit()
    except ValueError:
        pass
    return {"logged_out": True}


@router.get("/me", response_model=UserOut)
async def me(current: CurrentUser = Depends(get_current_user)):
    return UserOut.model_validate(current.user)
