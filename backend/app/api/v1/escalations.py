"""Escalations: list, ack, resolve. Admin-facing."""
from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, require_roles
from app.models.enums import EscalationStatus, UserRole
from app.models.models import Booking, ConsumerProfile, Escalation, WorkerProfile
from app.schemas.schemas import EscalationOut, EscalationResolveRequest
from app.services.common_services import audit

router = APIRouter(prefix="/escalations", tags=["escalations"])


_ADMIN_ROLES = {
    UserRole.admin_ops,
    UserRole.admin_clinical,
    UserRole.admin_super,
    UserRole.admin_finance,
}


@router.get("/open", response_model=List[EscalationOut])
async def list_open(
    current: CurrentUser = Depends(require_roles(UserRole.admin_ops, UserRole.admin_clinical, UserRole.admin_super)),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Escalation).where(Escalation.status != EscalationStatus.resolved).order_by(Escalation.level.desc(), Escalation.created_at.desc()))
    return [EscalationOut.model_validate(e) for e in res.scalars().all()]


@router.get("/", response_model=List[EscalationOut])
async def list_escalations(
    status: Optional[EscalationStatus] = None,
    booking_id: Optional[UUID] = None,
    current: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Production hardening: per-role scoping.
      - admin*  → unrestricted
      - worker  → only escalations on bookings assigned to them
      - consumer → only escalations on their own bookings
    booking_id filter is enforced AFTER scoping, so cross-tenant probing returns [].
    """
    conds = []
    if status:
        conds.append(Escalation.status == status)
    if booking_id:
        conds.append(Escalation.booking_id == booking_id)

    # Per-role scoping
    if current.role in _ADMIN_ROLES:
        pass  # full access
    elif current.role == UserRole.worker:
        wres = await db.execute(select(WorkerProfile).where(WorkerProfile.user_id == current.id))
        wp = wres.scalar_one_or_none()
        if not wp:
            return []
        conds.append(Escalation.worker_id == wp.id)
    elif current.role == UserRole.consumer:
        cres = await db.execute(select(ConsumerProfile).where(ConsumerProfile.user_id == current.id))
        cp = cres.scalar_one_or_none()
        if not cp:
            return []
        # Join via booking to ensure consumer owns the booking
        scoped = (
            select(Escalation)
            .join(Booking, Booking.id == Escalation.booking_id)
            .where(Booking.consumer_id == cp.id, *conds)
        )
        res = await db.execute(scoped)
        return [EscalationOut.model_validate(e) for e in res.scalars().all()]
    else:
        return []

    res = await db.execute(select(Escalation).where(and_(*conds)) if conds else select(Escalation))
    return [EscalationOut.model_validate(e) for e in res.scalars().all()]


@router.post("/{escalation_id}/acknowledge", response_model=EscalationOut)
async def acknowledge(
    escalation_id: UUID,
    current: CurrentUser = Depends(require_roles(UserRole.admin_ops, UserRole.admin_clinical, UserRole.admin_super)),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    e = res.scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    e.status = EscalationStatus.acknowledged
    e.acknowledged_by = current.id
    e.acknowledged_at = datetime.now(timezone.utc)
    await audit(db, current.id, current.role.value, "escalation.acknowledge", "escalation", e.id)
    await db.commit()
    await db.refresh(e)
    return EscalationOut.model_validate(e)


@router.post("/{escalation_id}/resolve", response_model=EscalationOut)
async def resolve(
    escalation_id: UUID,
    payload: EscalationResolveRequest,
    current: CurrentUser = Depends(require_roles(UserRole.admin_ops, UserRole.admin_clinical, UserRole.admin_super)),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Escalation).where(Escalation.id == escalation_id))
    e = res.scalar_one_or_none()
    if not e:
        raise HTTPException(status_code=404, detail="Not found")
    e.status = EscalationStatus.resolved
    e.resolved_by = current.id
    e.resolved_at = datetime.now(timezone.utc)
    e.resolution_notes = payload.resolution_notes
    await audit(db, current.id, current.role.value, "escalation.resolve", "escalation", e.id, {"notes": payload.resolution_notes})
    await db.commit()
    await db.refresh(e)
    return EscalationOut.model_validate(e)
