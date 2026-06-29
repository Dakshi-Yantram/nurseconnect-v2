# NurseConnect — PRD (Patch 5A)

## Scope

Patch 5A closes the **clinical safety, consent enforcement, insurance
assessment, and RBAC ownership** gaps left after Patch 4B. Backend-only
enforcement; **no new admin portals, no new mobile screens**.

## What changed

### Source-of-truth migration
- The Patch 4B codebase (Postgres + FastAPI + Redis + Celery + WebSockets)
  is now the canonical `/app/backend`. The boilerplate Mongo `server.py`
  was replaced. Postgres and Redis are installed and started on boot.
- `.env` updated to use local Postgres / Redis and mock external providers
  (Razorpay / MSG91) — see `/app/memory/test_credentials.md`.

### New service modules
- `app/services/consent_service.py` — `has_active_consent()` / `require_consent()`
  with stable error codes (`SERVICE_CONSENT_MISSING`, `PHOTO_CONSENT_MISSING`,
  `MEDICATION_CONSENT_MISSING`).
- `app/services/insurance_service.py` — `create_or_update_assessment()` and
  `evaluate_coverage()`. Idempotent at booking-id.

### Clinical rule engine
- `app/services/clinical_engine.py` extended with `evaluate_checklist_payload()`
  that scans submitted checklist answers (including `vitals_entry` payloads
  and free-text symptoms) against the booking's snapshotted clinical rule set.

### Endpoint enforcement
- `POST /api/visits/{id}/checkin` — service consent required.
- `POST /api/visits/{id}/checklist` — service consent required.
- `POST /api/visits/{id}/medications` — medication consent + prescription
  (when service.requires_prescription) + allergy check + identity confirmed.
- `POST /api/visits/{id}/checkout` — auto-creates / refreshes the
  `insurance_coverage_assessments` row.
- `POST /api/care/workflow/{id}/responses` — service consent + clinical
  rule evaluation; auto-creates an `escalations` row if triggered.
- `POST /api/care/workflow/{id}/documentation` — photo consent required
  when the item is a photo field or the template demands it.
- `POST /api/care/workflow/{id}/documentation/file` — photo consent required
  for every file upload.

### New API
- `GET /api/visits/{id}/insurance-assessment` — fetch the per-booking coverage
  assessment. Visible to the owning consumer, the assigned worker, and
  `admin_finance / admin_clinical / admin_super / admin_ops`.

### RBAC hardening
- `app/api/v1/care.py` (rewritten) centralises a `_patient_ownership_check()`
  used by `consents/*` and `abha-records/*`. Workers cannot revoke consents.
- Existing endpoints (`bookings`, `payments`, `training`) already enforced
  ownership — Patch 5A added test coverage to keep it that way.

### Insurance coverage criteria (`InsuranceCoverageAssessment`)
| Field                | Source                                                        |
| -------------------- | ------------------------------------------------------------- |
| checklist_complete   | `validate_documentation_completion()`                         |
| consent_obtained     | active `ConsentRecord` of type `service`                      |
| prescription_valid   | verified prescription (or only-required-if service flag set)  |
| tier_appropriate     | worker.tier ≥ service.min_tier                                |
| gps_verified         | check-in lat/lon present                                      |
| escalation_timely    | no open escalation past SLA breach                            |
| registration_valid   | `worker.registration_valid_until ≥ today`                     |

Statuses: 0 reasons → `covered`, 1 reason → `conditional` (50%),
≥2 reasons → `not_covered`.

## Files changed
- NEW: `app/services/consent_service.py`
- NEW: `app/services/insurance_service.py`
- MOD: `app/services/clinical_engine.py` (added `evaluate_checklist_payload`)
- MOD: `app/api/v1/visits.py` (consent gates, medication validation, insurance at checkout, GET assessment)
- MOD: `app/api/v1/care_workflow.py` (consent gates, checklist red-flag evaluation, photo consent on uploads)
- REWRITE: `app/api/v1/care.py` (ownership check on all consent + ABHA endpoints; worker-cannot-revoke rule)
- NEW: `backend/tests/test_patch5a.py` (19 focused enforcement + RBAC tests)
- NEW: `backend/tests/test_patch5a_e2e.py` (6 positive-path e2e tests)

## Test results
```
backend/tests/test_patch5a.py     ............. 19 passed
backend/tests/test_patch5a_e2e.py ......        6 passed
backend/tests/test_patch4b_lifecycle.py         42 passed
```

## Deliverables vs the brief

1. **Files changed**: see list above.
2. **New migrations**: none — Patch 4B's schema already had
   `clinical_rule_sets`, `checklist_templates`, `documentation_templates`,
   `consent_records`, `escalations`, `insurance_coverage_assessments`.
3. **New endpoints**: `GET /api/visits/{id}/insurance-assessment`.
4. **RBAC changes**: ownership check on `consents/*`, `abha-records/*`;
   workers blocked from revoking consents; reviewer endpoints already
   restricted to `admin_clinical | admin_super`.
5. **Clinical rule evaluation flow**: vitals (unchanged) + checklist responses
   (NEW) → creates `Escalation` row + broadcasts on the booking topic.
6. **Insurance assessment flow**: triggered automatically at checkout
   (`create_or_update_assessment`), idempotent, returns a structured summary
   on `GET /api/visits/{id}/insurance-assessment`.
7. **Test results**: 67/67 passing for Patch 4B + Patch 5A.

## Out of scope (per brief)
- Offline sync engine
- New admin screens / mobile screens
- Web portal enhancements
- Family app enhancements
- Analytics / reporting


---

# Patch 5B — Final Hardening (security & compliance)

## Scope

Patch 5B is the **final hardening patch**. No new workflows, no UI, no
business-logic refactors. Only the missing security & compliance gaps
identified after Patch 5A are closed.

## What changed

### New files (5)
- `app/security/__init__.py`
- `app/security/access_control.py` — centralized RBAC + ownership helpers:
  - `assert_admin_role`, `assert_admin_clinical`, `assert_admin_ops`,
    `assert_admin_finance`, `assert_admin_super`
  - `assert_user_can_access_patient`, `assert_user_can_access_booking`,
    `assert_worker_assigned_to_booking`, `assert_user_can_access_visit_record`
  - `assert_consumer_owns_patient`, `assert_consumer_owns_booking`
- `app/services/security_audit_service.py` — thin wrapper over the
  existing `audit()` infrastructure. Logs `security.access_denied`,
  `security.ownership_violation`, `security.ws_unauthorized`,
  `security.insurance_override`. **Storage: `audit_log` (existing).**
- `app/api/v1/insurance_review.py` — backend-only insurance review API.
- `backend/tests/test_patch5b_hardening.py` — 11 focused tests.

### Endpoints updated / added
| Endpoint                                       | Change                                                       |
|------------------------------------------------|--------------------------------------------------------------|
| `GET /api/tracking/booking/{id}/latest`        | Now enforces booking ownership / assigned worker / admin     |
| `WS /api/ws/booking/{id}`                      | Unauthorized subscriptions logged via `security_audit_service` |
| `WS /api/ws/user`                              | Unauthorized subscriptions logged                            |
| `GET /api/visits/{id}/vitals`                  | Now enforces booking ownership                               |
| `GET /api/visits/{id}`                         | Now enforces booking ownership                               |
| `GET /api/insurance/review-queue`              | NEW — admin_clinical \| admin_super                          |
| `GET /api/insurance/review/{id}`               | NEW — admin_clinical \| admin_super                          |
| `POST /api/insurance/review/{id}/override`     | NEW — requires justification; writes audit entry             |

### Security audit log shape (in `audit_log`)
- `action` ∈ {`security.access_denied`, `security.ownership_violation`,
  `security.ws_unauthorized`, `security.insurance_override`}.
- `entity_type` / `entity_id` always set when known.
- `changes` carries `endpoint`, `reason`, and for overrides a
  **summarized decision payload only**: `assessment_id`,
  `previous_decision`, `new_decision`, `previous_coverage_status`,
  `new_coverage_status`, `previous_coverage_percent`,
  `new_coverage_percent`, `justification`.

### Endpoint security audit — already-protected (left untouched)
- `care.py` (consents + ABHA): `_patient_ownership_check` already enforced.
- `care_workflow.py`: `_require_assigned_worker_or_admin` already enforced.
- `escalations.py`: per-role scoping already enforced.
- `bookings.py`, `payments.py`, `training.py`, `workers.py`, `admin.py`:
  ownership / role guards already present.

## Tests
```
backend/tests/test_patch5b_hardening.py  ............  11 passed
backend/tests/test_patch5a.py            ............  19 passed
```

## Success criteria met
1. ✅ Centralized RBAC helpers exist (`app/security/access_control.py`).
2. ✅ Sensitive endpoints protected (tracking, visits, websockets).
3. ✅ Tracking ownership enforced.
4. ✅ WebSocket authorization enforced (rejections audited).
5. ✅ Security audit logging exists (reuses `audit_log`).
6. ✅ Insurance review API exists (queue, detail, override).
7. ✅ No new UI created.
8. ✅ No business workflows modified.
9. ✅ Minimal code changes (5 new files, 4 surgical edits).
10. ✅ Patch 5 considered complete.

## Remaining intentional future-phase items
- Surface security audit stream in an admin dashboard (Patch 6).
- Frontend insurance reviewer UI (out of scope per Patch 5B spec).
- Real-time security alerting / SIEM forwarding (future ops work).
