"""Admin endpoints (catalog mgmt, worker approval, ledger, dashboards)."""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import CurrentUser, get_current_user, is_admin, require_roles
from app.models.enums import (
    BookingStatus,
    EscalationStatus,
    UserRole,
    UserStatus,
    WorkerOnboardingStatus,
)
from app.models.models import (
    Booking,
    ConsumerProfile,
    Escalation,
    FinancialLedger,
    User,
    WorkerProfile,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/dashboard")
async def admin_dashboard(
    current: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not is_admin(current.role):
        raise HTTPException(status_code=403, detail="Admin only")
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    total_consumers = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.consumer))).scalar() or 0
    total_workers = (await db.execute(select(func.count(User.id)).where(User.role == UserRole.worker))).scalar() or 0
    pending_workers = (await db.execute(select(func.count(WorkerProfile.id)).where(WorkerProfile.onboarding_status == WorkerOnboardingStatus.pending_review))).scalar() or 0
    bookings_today = (await db.execute(select(func.count(Booking.id)).where(Booking.scheduled_date == func.current_date()))).scalar() or 0
    open_escalations = (await db.execute(select(func.count(Escalation.id)).where(Escalation.status != EscalationStatus.resolved))).scalar() or 0
    return {
        "total_users": total_users,
        "total_consumers": total_consumers,
        "total_workers": total_workers,
        "pending_worker_approvals": pending_workers,
        "bookings_today": bookings_today,
        "open_escalations": open_escalations,
    }


@router.get("/workers/pending")
async def pending_workers(
    current: CurrentUser = Depends(require_roles(UserRole.admin_ops, UserRole.admin_super)),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(WorkerProfile, User).join(User, User.id == WorkerProfile.user_id).where(WorkerProfile.onboarding_status == WorkerOnboardingStatus.pending_review)
    )
    items = []
    for wp, u in res.all():
        items.append({"worker_id": str(wp.id), "user_id": str(u.id), "full_name": u.full_name, "phone": u.phone_e164, "tier": wp.tier.value, "created_at": wp.created_at.isoformat()})
    return items


@router.post("/workers/{worker_id}/approve")
async def approve_worker(
    worker_id: UUID,
    current: CurrentUser = Depends(require_roles(UserRole.admin_ops, UserRole.admin_super)),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(WorkerProfile).where(WorkerProfile.id == worker_id))
    wp = res.scalar_one_or_none()
    if not wp:
        raise HTTPException(status_code=404, detail="Worker not found")
    wp.onboarding_status = WorkerOnboardingStatus.approved
    await db.commit()
    return {"approved": True}


@router.post("/workers/{worker_id}/suspend")
async def suspend_worker(
    worker_id: UUID,
    reason: str,
    current: CurrentUser = Depends(require_roles(UserRole.admin_super)),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(WorkerProfile, User).join(User, User.id == WorkerProfile.user_id).where(WorkerProfile.id == worker_id))
    row = res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Worker not found")
    wp, user = row
    wp.onboarding_status = WorkerOnboardingStatus.suspended
    user.status = UserStatus.suspended
    await db.commit()
    return {"suspended": True}


@router.get("/financial/ledger")
async def ledger(
    booking_id: Optional[UUID] = None,
    worker_id: Optional[UUID] = None,
    consumer_id: Optional[UUID] = None,
    limit: int = 100,
    current: CurrentUser = Depends(require_roles(UserRole.admin_finance, UserRole.admin_ops, UserRole.admin_super)),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(FinancialLedger).order_by(FinancialLedger.created_at.desc()).limit(limit)
    if booking_id:
        stmt = stmt.where(FinancialLedger.booking_id == booking_id)
    if worker_id:
        stmt = stmt.where(FinancialLedger.worker_id == worker_id)
    if consumer_id:
        stmt = stmt.where(FinancialLedger.consumer_id == consumer_id)
    res = await db.execute(stmt)
    return [
        {
            "id": str(e.id),
            "entry_type": e.entry_type.value,
            "amount": float(e.amount),
            "currency": e.currency,
            "debit_account": e.debit_account,
            "credit_account": e.credit_account,
            "booking_id": str(e.booking_id) if e.booking_id else None,
            "worker_id": str(e.worker_id) if e.worker_id else None,
            "consumer_id": str(e.consumer_id) if e.consumer_id else None,
            "description": e.description,
            "created_at": e.created_at.isoformat(),
        }
        for e in res.scalars().all()
    ]


@router.post("/rematch/{booking_id}")
async def rematch_booking(
    booking_id: UUID,
    current: CurrentUser = Depends(require_roles(UserRole.admin_ops, UserRole.admin_super)),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(select(Booking).where(Booking.id == booking_id))
    b = res.scalar_one_or_none()
    if not b:
        raise HTTPException(status_code=404, detail="Not found")
    b.worker_id = None
    b.status = BookingStatus.rematch_pending
    b.rematch_count += 1
    await db.commit()
    return {"rematch_initiated": True, "attempt": b.rematch_count}
