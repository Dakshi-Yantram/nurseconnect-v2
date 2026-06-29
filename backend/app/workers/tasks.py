"""Celery task definitions.

Implementation note: these tasks use sync SQLAlchemy via the sync URL because
Celery doesn't natively run async event loops. Each task opens a short-lived
session.
"""
import logging
from datetime import date, datetime, timedelta, timezone

from celery.utils.log import get_task_logger
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.enums import (
    BookingStatus,
    EscalationStatus,
    OfflineSyncStatus,
    WorkerPayoutStatus,
)
from app.models.models import (
    Booking,
    DataRetentionSchedule,
    Escalation,
    OfflineSyncQueue,
    WorkerPayout,
)
from app.workers.celery_app import celery_app

logger = get_task_logger(__name__)

_engine = create_engine(settings.DATABASE_URL_SYNC, pool_pre_ping=True)


def _session() -> Session:
    return Session(bind=_engine)


@celery_app.task
def escalation_sla_check() -> dict:
    now = datetime.now(timezone.utc)
    with _session() as s:
        breaches = s.execute(
            select(Escalation).where(
                Escalation.status != EscalationStatus.resolved,
                Escalation.sla_breach_at.is_not(None),
                Escalation.sla_breach_at < now,
            )
        ).scalars().all()
        for esc in breaches:
            logger.warning("SLA breach on escalation %s level=%s", esc.id, esc.level.value)
            # In a real impl, notify admin + emit ws event
        s.commit()
        return {"checked_at": now.isoformat(), "breached": len(breaches)}


@celery_app.task
def process_payout_batch() -> dict:
    """Mark eligible pending payouts as scheduled (real impl would call Razorpay payouts)."""
    with _session() as s:
        pending = s.execute(
            select(WorkerPayout).where(WorkerPayout.status == WorkerPayoutStatus.pending)
        ).scalars().all()
        for p in pending:
            p.status = WorkerPayoutStatus.processing
            p.scheduled_at = datetime.now(timezone.utc)
        s.commit()
        return {"processed": len(pending)}


@celery_app.task
def retention_cleanup() -> dict:
    """Honour configured data retention schedules."""
    today = date.today()
    with _session() as s:
        schedules = s.execute(
            select(DataRetentionSchedule).where(DataRetentionSchedule.is_active.is_(True))
        ).scalars().all()
        total = 0
        for sched in schedules:
            cutoff = today - timedelta(days=sched.retention_days)
            # left as no-op in dev — real impl would delete/archive per data_type
            sched.last_run_at = datetime.now(timezone.utc)
            sched.records_processed = sched.records_processed or 0
            total += 1
        s.commit()
        return {"schedules_run": total}


@celery_app.task
def detect_missed_visits() -> dict:
    """Mark scheduled bookings whose scheduled_start_time + grace is past as missed."""
    now = datetime.now(timezone.utc)
    grace_minutes = 30
    with _session() as s:
        scheduled = s.execute(
            select(Booking).where(Booking.status == BookingStatus.assigned)
        ).scalars().all()
        missed = 0
        for b in scheduled:
            start_dt = datetime.combine(b.scheduled_date, b.scheduled_start_time, tzinfo=timezone.utc)
            if start_dt + timedelta(minutes=grace_minutes) < now:
                b.status = BookingStatus.missed
                missed += 1
        s.commit()
        return {"missed": missed}


@celery_app.task
def process_offline_sync_item(queue_id: str) -> dict:
    """Mark a single queue item as synced (used as callback after server materializes record)."""
    with _session() as s:
        s.execute(
            update(OfflineSyncQueue)
            .where(OfflineSyncQueue.id == queue_id)
            .values(sync_status=OfflineSyncStatus.synced, synced_at=datetime.now(timezone.utc))
        )
        s.commit()
        return {"queue_id": queue_id, "status": "synced"}
