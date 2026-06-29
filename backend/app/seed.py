"""Seed initial DB-driven configuration.

Idempotent: re-running won't duplicate rows.
Creates:
- Default missed visit policy
- Default clinical rule set
- Default checklist + documentation templates
- Default consent text versions
- A starter service catalogue + care package
- A starter training module
- Default data retention schedules
- Default system_configuration keys
- Demo admin + worker + consumer accounts (dev only)
"""
import asyncio
import logging
from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.core.database import AsyncSessionLocal, Base, engine
from app.models.enums import (
    BillingTrigger,
    ChecklistPhase,
    DrugAllergyEscalation,
    GenderRestriction,
    RetentionAction,
    ServiceCategory,
    ServiceRiskLevel,
    UserRole,
    UserStatus,
    VisitFrequency,
    WorkerOnboardingStatus,
    WorkerPreferenceStatus,
    WorkerQualificationSource,
    WorkerQualificationStatus,
    WorkerTier,
)
from app.models.models import (
    AssessmentModule,
    CarePackage,
    ChecklistTemplate,
    ClinicalRuleSet,
    ConsentTextVersion,
    ConsumerProfile,
    DataRetentionSchedule,
    DocumentationTemplate,
    FeatureFlag,
    MissedVisitPolicy,
    Patient,
    ServiceCatalogue,
    SubsidyEligibility,
    SystemConfiguration,
    TrainingModule,
    User,
    WorkerKitItem,
    WorkerProfile,
    WorkerServicePreference,
    WorkerServiceQualification,
)

logger = logging.getLogger(__name__)


async def ensure_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Post-table migration: ensure production-grade idempotency guards exist on
    # tables that pre-date a constraint. Safe to re-run (idempotent SQL).
    await _ensure_payment_collected_uniqueness()
    # Patch 4B — add lifecycle columns to pre-existing template tables.
    await _ensure_patch_4b_lifecycle_columns()


async def _ensure_patch_4b_lifecycle_columns() -> None:
    """Patch 4B — idempotent ALTER TABLE migrations.

    Adds lifecycle / approval columns to tables that pre-date Patch 4B
    (training_modules, checklist_templates, documentation_templates) and the
    Patch 4B assessment linkage columns to service_catalogue + care_packages.
    Safe to re-run: every statement uses IF NOT EXISTS or CREATE TYPE guards.
    """
    from sqlalchemy import text  # local import

    statements: list[str] = [
        # content_status enum (Postgres types lack IF NOT EXISTS in CREATE TYPE)
        """
        DO $$ BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_status') THEN
            CREATE TYPE content_status AS ENUM ('draft','under_review','approved','rejected','published');
          END IF;
        END $$;
        """,
        # TrainingModule lifecycle
        "ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS status content_status NOT NULL DEFAULT 'published'",
        "ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS created_by UUID",
        "ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS updated_by UUID",
        "ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS reviewed_by UUID",
        "ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ",
        "ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS review_notes TEXT",
        "ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS published_version INTEGER",
        "ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ",
        "ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()",
        # ChecklistTemplate lifecycle
        "ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS status content_status NOT NULL DEFAULT 'published'",
        "ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS updated_by UUID",
        "ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS reviewed_by UUID",
        "ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ",
        "ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS review_notes TEXT",
        "ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS published_version INTEGER",
        "ALTER TABLE checklist_templates ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ",
        # DocumentationTemplate lifecycle
        "ALTER TABLE documentation_templates ADD COLUMN IF NOT EXISTS status content_status NOT NULL DEFAULT 'published'",
        "ALTER TABLE documentation_templates ADD COLUMN IF NOT EXISTS updated_by UUID",
        "ALTER TABLE documentation_templates ADD COLUMN IF NOT EXISTS reviewed_by UUID",
        "ALTER TABLE documentation_templates ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ",
        "ALTER TABLE documentation_templates ADD COLUMN IF NOT EXISTS review_notes TEXT",
        "ALTER TABLE documentation_templates ADD COLUMN IF NOT EXISTS published_version INTEGER",
        "ALTER TABLE documentation_templates ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ",
        # ServiceCatalogue + CarePackage — assessment linkage
        "ALTER TABLE service_catalogue ADD COLUMN IF NOT EXISTS required_assessment_codes VARCHAR[]",
        "ALTER TABLE service_catalogue ADD COLUMN IF NOT EXISTS minimum_pass_score INTEGER",
        "ALTER TABLE care_packages ADD COLUMN IF NOT EXISTS required_assessment_codes VARCHAR[]",
        "ALTER TABLE care_packages ADD COLUMN IF NOT EXISTS minimum_pass_score INTEGER",
    ]
    async with engine.begin() as conn:
        if conn.dialect.name != "postgresql":
            return
        for stmt in statements:
            try:
                await conn.execute(text(stmt))
            except Exception as e:  # noqa: BLE001
                logger.warning("Patch 4B migration step failed (continuing): %s | %s", stmt[:80], e)


async def _ensure_payment_collected_uniqueness() -> None:
    """Hard DB protection: at most one 'payment_collected' ledger row per
    razorpay_payment_id. Complements application-level guards in
    /payments/verify + /payments/webhook/razorpay so concurrent callbacks
    can never produce a duplicate ledger entry.

    Strategy (idempotent + race-safe + non-destructive):
      1. Detect existing duplicates. If found, log a loud warning and SKIP
         the index creation — we never silently delete financial rows.
         The application-level guard still prevents new duplicates.
      2. Otherwise, CREATE UNIQUE INDEX IF NOT EXISTS … (partial, Postgres only).
      3. Tolerate non-Postgres dialects (unit-test SQLite etc.) by no-oping.
    """
    from sqlalchemy import text  # local import to avoid module-level dep

    async with engine.begin() as conn:
        dialect = conn.dialect.name
        if dialect != "postgresql":
            return
        dup_check = await conn.execute(text(
            """
            SELECT razorpay_payment_id, COUNT(*) AS c
            FROM financial_ledger
            WHERE entry_type = 'payment_collected'
              AND razorpay_payment_id IS NOT NULL
            GROUP BY razorpay_payment_id
            HAVING COUNT(*) > 1
            LIMIT 5
            """
        ))
        duplicates = dup_check.fetchall()
        if duplicates:
            logger.error(
                "Duplicate payment_collected ledger rows detected — "
                "skipping unique-index creation. Affected payment_ids (first 5): %s. "
                "Resolve manually before deploying the constraint.",
                [r[0] for r in duplicates],
            )
            return
        # CREATE UNIQUE INDEX is idempotent via IF NOT EXISTS. Partial predicate
        # mirrors the SQLAlchemy `Index(... postgresql_where=...)` declaration
        # on FinancialLedger so existing DBs converge to the same schema.
        await conn.execute(text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS ux_financial_ledger_payment_collected_per_pid
              ON financial_ledger (razorpay_payment_id)
              WHERE entry_type = 'payment_collected'
                AND razorpay_payment_id IS NOT NULL
            """
        ))
        logger.info("ux_financial_ledger_payment_collected_per_pid ensured")


async def _ensure_unique(db, model, lookup: dict, defaults: dict):
    stmt = select(model)
    for k, v in lookup.items():
        stmt = stmt.where(getattr(model, k) == v)
    res = await db.execute(stmt)
    inst = res.scalar_one_or_none()
    if inst:
        return inst, False
    inst = model(**{**lookup, **defaults})
    db.add(inst)
    await db.flush()
    return inst, True


async def seed() -> dict:
    await ensure_tables()
    counts = {}
    async with AsyncSessionLocal() as db:
        # 1. Missed visit policy
        policy, _ = await _ensure_unique(
            db, MissedVisitPolicy,
            {"policy_code": "default_v1"},
            {"name": "Default Missed Visit Policy", "grace_period_minutes": 30, "auto_rematch": True, "rematch_attempts_max": 3, "consumer_refund_pct": Decimal("100"), "worker_penalty_pct": Decimal("0")},
        )

        # 2. Clinical rule set
        rule_set, _ = await _ensure_unique(
            db, ClinicalRuleSet,
            {"rule_set_code": "default_clinical_v1"},
            {
                "name": "Default Clinical Rule Set v1",
                "vital_thresholds": {
                    "bp_systolic": {"warning_high": 160, "critical_high": 180, "warning_low": 90, "critical_low": 70},
                    "bp_diastolic": {"warning_high": 100, "critical_high": 120, "warning_low": 50, "critical_low": 40},
                    "pulse": {"warning_high": 120, "critical_high": 140, "warning_low": 50, "critical_low": 40},
                    "spo2": {"critical_low": 94, "warning_low": 95},
                    "temperature_f": {"warning_high": 101, "critical_high": 103.5},
                    "respiratory_rate": {"warning_high": 24, "critical_high": 30, "warning_low": 10, "critical_low": 8},
                },
                "red_flag_symptoms": [
                    {"symptom": "chest_pain", "escalation_level": "emergency", "notify": ["worker", "family", "ops", "emergency_desk"]},
                    {"symptom": "severe_bleeding", "escalation_level": "emergency", "notify": ["worker", "family", "ops", "emergency_desk"]},
                    {"symptom": "loss_of_consciousness", "escalation_level": "emergency", "notify": ["worker", "family", "ops", "emergency_desk"]},
                    {"symptom": "severe_breathlessness", "escalation_level": "contact_doctor", "notify": ["worker", "family", "ops"]},
                    {"symptom": "high_fever", "escalation_level": "inform_family", "notify": ["worker", "family"]},
                ],
                "allergy_check_required": True,
                "drug_allergy_escalation": DrugAllergyEscalation.block,
                "escalation_levels": {
                    "watch": {"notify": ["worker"], "sla_minutes": 60},
                    "inform_family": {"notify": ["worker", "family"], "sla_minutes": 30},
                    "contact_doctor": {"notify": ["worker", "family", "ops", "doctor"], "sla_minutes": 15},
                    "emergency": {"notify": ["worker", "family", "ops", "emergency_desk"], "sla_minutes": 5, "auto_call_112": True},
                },
                "refusal_of_care_protocol": {"document_required": True, "family_notification": True, "admin_notification": True, "allowed_to_leave": True, "escalation_level": "inform_family"},
                "insurance_coverage_rules": {"covered_when": "all_checks_passed", "not_covered_when": "consent_missing OR checklist_incomplete"},
            },
        )

        # 3. Checklist template
        checklist, _ = await _ensure_unique(
            db, ChecklistTemplate,
            {"code": "generic_visit_v1"},
            {
                "name": "Generic Home Visit Checklist",
                "phase": ChecklistPhase.all,
                "service_codes": ["GENERAL_NURSING", "IV_INFUSION", "WOUND_DRESSING"],
                "questions": [
                    {"id": "vitals_recorded", "text": "Have you recorded baseline vitals?", "type": "boolean", "required": True, "mandatory_for_insurance": True},
                    {"id": "patient_consent", "text": "Has verbal consent been obtained?", "type": "boolean", "required": True, "consent_required": True},
                    {"id": "patient_allergies_confirmed", "text": "Have allergies been confirmed?", "type": "boolean", "required": True},
                    {"id": "patient_complaints", "text": "Any new symptoms or complaints?", "type": "text", "required": False},
                    {"id": "intervention_performed", "text": "Describe the intervention performed.", "type": "text", "required": True},
                    {"id": "patient_response", "text": "Patient response to intervention", "type": "select", "options": ["stable", "improved", "deteriorated"], "required": True, "escalation_trigger": True},
                ],
            },
        )

        # 4. Documentation template
        doc_tpl, _ = await _ensure_unique(
            db, DocumentationTemplate,
            {"template_code": "generic_documentation_v1"},
            {
                "name": "Generic Visit Documentation",
                "mandatory_fields": [
                    {"field_id": "vitals_recorded", "label": "Vitals reading captured", "type": "vitals_entry", "required": True, "blocks_checkout": True},
                    {"field_id": "family_summary", "label": "Family summary written", "type": "textarea", "required": True, "blocks_checkout": True},
                ],
                "photo_consent_required": True,
                "wound_image_mandatory": False,
            },
        )

        # ------------------------------------------------------------------
        # Patch 4 — Service-specific checklist + documentation templates.
        # All seeded as ``demo/seed-only`` data. Runtime behaviour stays
        # 100% DB-driven; admin portal can publish new versions later.
        # ------------------------------------------------------------------
        baby_bath_checklist, _ = await _ensure_unique(
            db, ChecklistTemplate,
            {"code": "baby_bath_v1"},
            {
                "name": "Baby Bath Visit Checklist",
                "phase": ChecklistPhase.all,
                "service_codes": ["BABY_BATH"],
                "questions": [
                    {"id": "room_temperature_ok", "text": "Room temperature comfortable for the baby?", "type": "boolean", "required": True},
                    {"id": "water_temperature_ok", "text": "Water temperature checked (36–37°C)?", "type": "boolean", "required": True},
                    {"id": "umbilical_care_done", "text": "Umbilical area cleaned and dried (if applicable)", "type": "boolean", "required": False},
                    {"id": "skin_observation", "text": "Skin condition observations", "type": "textarea", "required": False},
                    {"id": "baby_response", "text": "Baby's response", "type": "single_select", "options": ["calm", "fussy", "needs_attention"], "required": True},
                ],
            },
        )
        baby_bath_doc, _ = await _ensure_unique(
            db, DocumentationTemplate,
            {"template_code": "baby_bath_documentation_v1"},
            {
                "name": "Baby Bath Visit Documentation",
                "mandatory_fields": [
                    {"field_id": "family_summary", "label": "Family-facing summary", "type": "textarea", "required": True, "blocks_checkout": True},
                ],
                "photo_consent_required": False,
                "wound_image_mandatory": False,
            },
        )

        wound_checklist, _ = await _ensure_unique(
            db, ChecklistTemplate,
            {"code": "wound_dressing_v1"},
            {
                "name": "Wound Dressing Checklist",
                "phase": ChecklistPhase.all,
                "service_codes": ["WOUND_DRESSING"],
                "questions": [
                    {"id": "patient_consent", "text": "Verbal consent obtained for wound care", "type": "boolean", "required": True},
                    {"id": "sterile_setup", "text": "Sterile dressing field prepared", "type": "boolean", "required": True},
                    {"id": "wound_assessment", "text": "Wound assessment (size, exudate, odour)", "type": "textarea", "required": True},
                    {"id": "infection_signs", "text": "Signs of infection observed", "type": "multi_select", "options": ["redness", "swelling", "warmth", "purulent_discharge", "fever", "none"], "required": True},
                    {"id": "dressing_type", "text": "Dressing type used", "type": "text", "required": True},
                ],
            },
        )
        wound_doc, _ = await _ensure_unique(
            db, DocumentationTemplate,
            {"template_code": "wound_documentation_v1"},
            {
                "name": "Wound Care Documentation",
                "mandatory_fields": [
                    {"field_id": "wound_photo", "label": "Wound photo (clinical)", "type": "photo", "required": True, "blocks_checkout": True},
                    {"field_id": "family_summary", "label": "Family-facing summary", "type": "textarea", "required": True, "blocks_checkout": True},
                ],
                "photo_consent_required": True,
                "wound_image_mandatory": True,
            },
        )

        vitals_checklist, _ = await _ensure_unique(
            db, ChecklistTemplate,
            {"code": "vitals_visit_v1"},
            {
                "name": "Vitals Monitoring Checklist",
                "phase": ChecklistPhase.all,
                "service_codes": ["VITALS_VISIT"],
                "questions": [
                    {"id": "patient_identified", "text": "Patient identity verified", "type": "boolean", "required": True},
                    {"id": "vitals_recorded", "text": "Baseline vitals recorded", "type": "vitals_entry", "required": True},
                    {"id": "patient_complaints", "text": "Any new complaints or symptoms?", "type": "textarea", "required": False},
                ],
            },
        )
        vitals_doc, _ = await _ensure_unique(
            db, DocumentationTemplate,
            {"template_code": "vitals_documentation_v1"},
            {
                "name": "Vitals Visit Documentation",
                "mandatory_fields": [
                    {"field_id": "vitals_recorded", "label": "Vitals reading", "type": "vitals_entry", "required": True, "blocks_checkout": True},
                    {"field_id": "family_summary", "label": "Family-facing summary", "type": "textarea", "required": True, "blocks_checkout": True},
                ],
                "photo_consent_required": False,
                "wound_image_mandatory": False,
            },
        )

        injection_checklist, _ = await _ensure_unique(
            db, ChecklistTemplate,
            {"code": "injection_safety_v1"},
            {
                "name": "Injection / IV Safety Checklist",
                "phase": ChecklistPhase.all,
                "service_codes": ["IV_INFUSION", "INTRAMUSCULAR_INJECTION"],
                "questions": [
                    {"id": "patient_identified", "text": "Two-identifier check completed", "type": "boolean", "required": True},
                    {"id": "allergy_check", "text": "Drug allergy check completed", "type": "boolean", "required": True},
                    {"id": "prescription_verified", "text": "Prescription verified against drug + dose + route", "type": "boolean", "required": True},
                    {"id": "site_prepared", "text": "Injection site cleaned and prepared", "type": "boolean", "required": True},
                    {"id": "consent_confirmed", "text": "Patient consent confirmed", "type": "consent_confirmation", "required": True},
                    {"id": "medication_admin", "text": "Medication administered", "type": "medication_entry", "required": True},
                ],
            },
        )
        injection_doc, _ = await _ensure_unique(
            db, DocumentationTemplate,
            {"template_code": "injection_documentation_v1"},
            {
                "name": "Injection / IV Documentation",
                "mandatory_fields": [
                    {"field_id": "medication_admin", "label": "Medication administered (drug, dose, route)", "type": "medication_entry", "required": True, "blocks_checkout": True},
                    {"field_id": "post_admin_observation", "label": "Post-administration observation (30 min)", "type": "textarea", "required": True, "blocks_checkout": True},
                    {"field_id": "family_summary", "label": "Family-facing summary", "type": "textarea", "required": True, "blocks_checkout": True},
                ],
                "photo_consent_required": False,
                "wound_image_mandatory": False,
            },
        )


        # 5. Service catalogue
        svc_general, _ = await _ensure_unique(
            db, ServiceCatalogue,
            {"service_code": "GENERAL_NURSING"},
            {
                "name": "General Home Nursing Visit",
                "description": "Routine home nursing visit including vitals, medication administration, basic care.",
                "category": ServiceCategory.micro_visit,
                "min_tier": WorkerTier.tier2,
                "duration_minutes": 60,
                "base_price": Decimal("499.00"),
                "max_price": Decimal("899.00"),
                "commission_pct": Decimal("20.00"),
                "urgent_surge_pct": 25,
                "requires_prescription": False,
                "checklist_template_id": checklist.id,
                "escalation_rule_set_id": rule_set.id,
                "documentation_template_id": doc_tpl.id,
                "billing_trigger": BillingTrigger.on_completion,
                "missed_visit_policy_id": policy.id,
                "family_summary_template": "Visit completed for {{patient_name}}. Vitals: BP {{bp_systolic}}/{{bp_diastolic}}, Pulse {{pulse}}, SpO₂ {{spo2}}%. Next visit: {{next_visit_date}}.",
                "insurance_covered": True,
                "icon": "stethoscope",
                "risk_level": ServiceRiskLevel.LOW,
                "required_training_module_codes": [],
            },
        )
        svc_iv, _ = await _ensure_unique(
            db, ServiceCatalogue,
            {"service_code": "IV_INFUSION"},
            {
                "name": "IV Infusion at Home",
                "description": "Administered IV fluids / medications under clinical supervision.",
                "category": ServiceCategory.micro_visit,
                "min_tier": WorkerTier.tier3,
                "duration_minutes": 90,
                "base_price": Decimal("799.00"),
                "max_price": Decimal("1499.00"),
                "commission_pct": Decimal("20.00"),
                "requires_prescription": True,
                "prescription_drug_classes": ["antibiotic", "analgesic", "iv_fluid"],
                "checklist_template_id": injection_checklist.id,
                "escalation_rule_set_id": rule_set.id,
                "documentation_template_id": injection_doc.id,
                "billing_trigger": BillingTrigger.on_completion,
                "missed_visit_policy_id": policy.id,
                "insurance_covered": True,
                "icon": "iv-bag",
                "risk_level": ServiceRiskLevel.MEDIUM,
                "required_training_module_codes": ["IV_INFUSION_V1"],
            },
        )
        svc_wound, _ = await _ensure_unique(
            db, ServiceCatalogue,
            {"service_code": "WOUND_DRESSING"},
            {
                "name": "Wound Dressing & Care",
                "description": "Clean, dress and document wound condition.",
                "category": ServiceCategory.micro_visit,
                "min_tier": WorkerTier.tier2,
                "duration_minutes": 45,
                "base_price": Decimal("399.00"),
                "commission_pct": Decimal("20.00"),
                "checklist_template_id": wound_checklist.id,
                "escalation_rule_set_id": rule_set.id,
                "documentation_template_id": wound_doc.id,
                "billing_trigger": BillingTrigger.on_completion,
                "missed_visit_policy_id": policy.id,
                "insurance_covered": True,
                "icon": "bandage",
                "risk_level": ServiceRiskLevel.LOW,
                "required_training_module_codes": [],
            },
        )

        # Patch 4 — Baby bath (low risk)
        svc_baby_bath, _ = await _ensure_unique(
            db, ServiceCatalogue,
            {"service_code": "BABY_BATH"},
            {
                "name": "Baby Bath at Home",
                "description": "Gentle bath, umbilical care and skin observation for newborns.",
                "category": ServiceCategory.micro_visit,
                "min_tier": WorkerTier.tier2,
                "duration_minutes": 30,
                "base_price": Decimal("299.00"),
                "commission_pct": Decimal("18.00"),
                "checklist_template_id": baby_bath_checklist.id,
                "escalation_rule_set_id": rule_set.id,
                "documentation_template_id": baby_bath_doc.id,
                "billing_trigger": BillingTrigger.on_completion,
                "missed_visit_policy_id": policy.id,
                "family_summary_template": "Baby bath completed for {{patient_name}}. Skin observations noted. Next bath: {{next_visit_date}}.",
                "insurance_covered": False,
                "icon": "baby",
                "risk_level": ServiceRiskLevel.LOW,
                "required_training_module_codes": [],
            },
        )

        # Patch 4 — Vitals visit (low risk, vitals-only template)
        svc_vitals, _ = await _ensure_unique(
            db, ServiceCatalogue,
            {"service_code": "VITALS_VISIT"},
            {
                "name": "Vitals Monitoring Visit",
                "description": "Quick vitals check + trend log for chronic-care patients.",
                "category": ServiceCategory.micro_visit,
                "min_tier": WorkerTier.tier2,
                "duration_minutes": 20,
                "base_price": Decimal("249.00"),
                "commission_pct": Decimal("18.00"),
                "checklist_template_id": vitals_checklist.id,
                "escalation_rule_set_id": rule_set.id,
                "documentation_template_id": vitals_doc.id,
                "billing_trigger": BillingTrigger.on_completion,
                "missed_visit_policy_id": policy.id,
                "family_summary_template": "Vitals visit completed for {{patient_name}}. BP {{bp_systolic}}/{{bp_diastolic}}, Pulse {{pulse}}, SpO₂ {{spo2}}%.",
                "insurance_covered": True,
                "icon": "stethoscope",
                "risk_level": ServiceRiskLevel.LOW,
                "required_training_module_codes": [],
            },
        )

        # Patch 4 — Intramuscular injection (medium risk, safety checklist)
        svc_im_inj, _ = await _ensure_unique(
            db, ServiceCatalogue,
            {"service_code": "INTRAMUSCULAR_INJECTION"},
            {
                "name": "Intramuscular Injection at Home",
                "description": "Single-dose IM injection administered by a qualified nurse.",
                "category": ServiceCategory.micro_visit,
                "min_tier": WorkerTier.tier3,
                "duration_minutes": 30,
                "base_price": Decimal("349.00"),
                "commission_pct": Decimal("20.00"),
                "requires_prescription": True,
                "checklist_template_id": injection_checklist.id,
                "escalation_rule_set_id": rule_set.id,
                "documentation_template_id": injection_doc.id,
                "billing_trigger": BillingTrigger.on_completion,
                "missed_visit_policy_id": policy.id,
                "insurance_covered": True,
                "icon": "syringe",
                "risk_level": ServiceRiskLevel.MEDIUM,
                "required_training_module_codes": [],
            },
        )

        # Patch 4 — Critical service intentionally seeded WITHOUT templates so
        # the runtime engine can demonstrate CLINICAL_TEMPLATE_MISSING. Admins
        # can later publish templates against this service via the web portal.
        await _ensure_unique(
            db, ServiceCatalogue,
            {"service_code": "HIGH_RISK_NO_TEMPLATE_TEST"},
            {
                "name": "High-Risk Service (template missing — test only)",
                "description": "Demo row used to exercise CLINICAL_TEMPLATE_MISSING enforcement.",
                "category": ServiceCategory.micro_visit,
                "min_tier": WorkerTier.tier4,
                "duration_minutes": 60,
                "base_price": Decimal("999.00"),
                "commission_pct": Decimal("18.00"),
                "checklist_template_id": None,
                "documentation_template_id": None,
                "escalation_rule_set_id": rule_set.id,
                "billing_trigger": BillingTrigger.on_completion,
                "missed_visit_policy_id": policy.id,
                "insurance_covered": False,
                "icon": "alert",
                "risk_level": ServiceRiskLevel.HIGH,
                "required_training_module_codes": [],
            },
        )
        # High-risk PICC line care — requires admin approval
        svc_picc, _ = await _ensure_unique(
            db, ServiceCatalogue,
            {"service_code": "PICC_LINE_CARE"},
            {
                "name": "PICC Line Care",
                "description": "Specialist PICC line maintenance and dressing.",
                "category": ServiceCategory.micro_visit,
                "min_tier": WorkerTier.tier4,
                "duration_minutes": 60,
                "base_price": Decimal("1499.00"),
                "commission_pct": Decimal("18.00"),
                "checklist_template_id": checklist.id,
                "escalation_rule_set_id": rule_set.id,
                "documentation_template_id": doc_tpl.id,
                "billing_trigger": BillingTrigger.on_completion,
                "missed_visit_policy_id": policy.id,
                "insurance_covered": True,
                "icon": "infusion",
                "risk_level": ServiceRiskLevel.CRITICAL,
                "requires_admin_skill_approval": True,
                "required_training_module_codes": ["PICC_LINE_V1"],
            },
        )

        # 6. Care package
        await _ensure_unique(
            db, CarePackage,
            {"package_code": "POST_OP_CARE_7D"},
            {
                "name": "Post-Operative Care – 7 Days",
                "tagline": "Daily nursing visits after surgery",
                "description": "Daily wound care, vitals monitoring, and recovery support for 7 days post-surgery.",
                "target_condition": "Post-operative recovery",
                "min_tier": WorkerTier.tier3,
                "gender_restriction": GenderRestriction.any,
                "primary_service_id": svc_general.id,
                "included_service_ids": [svc_general.id, svc_wound.id],
                "visit_frequency": VisitFrequency.daily,
                "visits_per_cycle": 7,
                "cycle_duration_days": 7,
                "package_price": Decimal("3499.00"),
                "per_visit_price": Decimal("499.00"),
                "subsidy_eligible": True,
                "commission_pct": Decimal("18.00"),
                "checklist_template_id": checklist.id,
                "escalation_rule_set_id": rule_set.id,
                "documentation_template_id": doc_tpl.id,
                "missed_visit_policy_id": policy.id,
                "family_report_frequency": "daily",
                "insurance_covered": True,
                "available_cities": ["Mumbai", "Delhi", "Bangalore", "Pune", "Chennai"],
            },
        )

        # 7. Consent text versions
        for ctype, body in [
            ("service", "I consent to receive the requested nursing service from the assigned worker."),
            ("photo", "I consent to clinical photographs of wounds being taken for documentation."),
            ("medication", "I consent to administration of medications per attached prescription."),
            ("data_retention", "I consent to my health data being retained per platform policy."),
        ]:
            await _ensure_unique(
                db, ConsentTextVersion,
                {"consent_type": ctype, "version": "v1", "language": "en"},
                {"text_content": body, "is_active": True},
            )

        # 8. Data retention schedules
        for dt, days, action in [
            ("audit_log", 2555, RetentionAction.archive),  # 7 years
            ("worker_location_log", 90, RetentionAction.delete),
            ("notification_log", 365, RetentionAction.delete),
            ("offline_sync_queue", 30, RetentionAction.delete),
        ]:
            await _ensure_unique(
                db, DataRetentionSchedule,
                {"data_type": dt},
                {"retention_days": days, "action_after": action, "is_active": True},
            )

        # 9. System config
        for k, v, desc in [
            ("default_urgent_surge_pct", "25", "Default surge percentage for urgent bookings"),
            ("min_app_version_ios", "1.0.0", "Minimum required iOS app version"),
            ("min_app_version_android", "1.0.0", "Minimum required Android app version"),
            ("maintenance_mode", "false", "Set to true to enable maintenance mode"),
            ("platform_tds_pct", "1.0", "TDS percentage on worker payouts"),
        ]:
            await _ensure_unique(db, SystemConfiguration, {"key": k}, {"value": v, "description": desc})

        # 10. Feature flags
        for code, name in [
            ("abha_integration_enabled", "ABHA Integration"),
            ("offline_mode_enabled", "Offline-first Nurse Mode"),
            ("subsidy_visibility_enabled", "Subsidy Visibility for Consumers"),
        ]:
            await _ensure_unique(db, FeatureFlag, {"flag_code": code}, {"name": name, "is_enabled": True, "rollout_percent": 100})

        # 11. Training modules
        bls_module, _ = await _ensure_unique(
            db, TrainingModule,
            {"code": "BASIC_LIFE_SUPPORT_V1"},
            {
                "title": "Basic Life Support (BLS) – Fundamentals",
                "description": "Cardiopulmonary resuscitation and emergency response fundamentals.",
                "category": "Emergency",
                "duration_minutes": 60,
                "required_for_tiers": ["tier2", "tier3", "tier4", "tier5"],
                "video_url": "https://example.com/videos/bls.mp4",
                "assessment": [
                    {"question": "What is the recommended CPR compression rate?", "options": ["60-80/min", "100-120/min", "140-160/min"], "correct_index": 1},
                    {"question": "Adult CPR compression depth?", "options": ["1 inch", "2 inches", "4 inches"], "correct_index": 1},
                ],
                "pass_percent": 70,
                "is_mandatory": True,
            },
        )
        iv_module, _ = await _ensure_unique(
            db, TrainingModule,
            {"code": "IV_INFUSION_V1"},
            {
                "title": "IV Infusion Safety & Technique",
                "description": "Safe cannulation, infusion rate control, and adverse-event response.",
                "category": "Skill",
                "duration_minutes": 75,
                "required_for_tiers": ["tier3", "tier4", "tier5"],
                "video_url": "https://example.com/videos/iv.mp4",
                "assessment": [
                    {"question": "Maximum recommended IV cannula dwell time (peripheral)?", "options": ["12 hours", "72-96 hours", "2 weeks"], "correct_index": 1},
                    {"question": "Immediate action on infiltration?", "options": ["Increase rate", "Stop infusion and assess", "Ignore if minor"], "correct_index": 1},
                ],
                "pass_percent": 70,
                "is_mandatory": False,
            },
        )
        picc_module, _ = await _ensure_unique(
            db, TrainingModule,
            {"code": "PICC_LINE_V1"},
            {
                "title": "PICC Line Care & Maintenance",
                "description": "Sterile dressing changes, flushing protocols, and complications.",
                "category": "Skill",
                "duration_minutes": 90,
                "required_for_tiers": ["tier4", "tier5"],
                "video_url": "https://example.com/videos/picc.mp4",
                "assessment": [
                    {"question": "Recommended PICC flush solution?", "options": ["Heparin only", "Saline ± heparin per protocol", "Sterile water"], "correct_index": 1},
                    {"question": "Sign of catheter-related bloodstream infection?", "options": ["Fever and exit-site redness", "Mild itch", "Normal vitals"], "correct_index": 0},
                ],
                "pass_percent": 80,
                "is_mandatory": False,
            },
        )

        # 12. Demo users (dev convenience)
        from app.core.security import hash_password
        demo = [
            ("+919999000001", "Aanya Sharma", UserRole.consumer),
            ("+919999000002", "Nurse Riya Kapoor", UserRole.worker),
            ("+919999000007", "Nurse Meera Iyer", UserRole.worker),  # second worker for race tests
            ("+919999000003", "Admin Ops", UserRole.admin_ops),
            ("+919999000004", "Admin Super", UserRole.admin_super),
            ("+919999000005", "Admin Finance", UserRole.admin_finance),
            ("+919999000006", "Admin Clinical", UserRole.admin_clinical),
        ]
        for phone, name, role in demo:
            u_res = await db.execute(select(User).where(User.phone_e164 == phone))
            u = u_res.scalar_one_or_none()
            if not u:
                u = User(phone_e164=phone, full_name=name, role=role, status=UserStatus.active, password_hash=hash_password("Test@1234"))
                db.add(u)
                await db.flush()
                if role == UserRole.consumer:
                    cp = ConsumerProfile(user_id=u.id, city="Mumbai", state="Maharashtra", pincode="400001", address_line1="42 Marine Drive",
                                          latitude=Decimal("18.9430"), longitude=Decimal("72.8235"))
                    db.add(cp)
                    await db.flush()
                    p = Patient(consumer_id=cp.id, full_name="Mr. Rohit Sharma", relationship_to_consumer="Father", blood_group="O+", allergies=["penicillin"], is_minor=False)
                    db.add(p)
                    db.add(SubsidyEligibility(consumer_id=cp.id, subsidy_type="none", subsidy_percent=Decimal("0")))
                elif role == UserRole.worker:
                    # Patch 3 — seed home coordinates so proximity filtering is
                    # testable end-to-end. Riya ~1km from booking site, Meera ~2km.
                    if phone == "+919999000002":
                        home_lat, home_lng = Decimal("18.9520"), Decimal("72.8235")  # ~1km north
                    else:  # Meera
                        home_lat, home_lng = Decimal("18.9610"), Decimal("72.8235")  # ~2km north
                    wp = WorkerProfile(
                        user_id=u.id,
                        tier=WorkerTier.tier3,
                        gender="female",
                        onboarding_status=WorkerOnboardingStatus.approved,
                        availability="online",
                        years_of_experience=5,
                        languages_spoken=["English", "Hindi", "Marathi"],
                        specialisations=["Wound care", "Geriatric care"],
                        registration_no="MNC-2020-12345",
                        registration_authority="Maharashtra Nursing Council",
                        registration_valid_until=date(2027, 12, 31),
                        base_city="Mumbai",
                        service_radius_km=15,
                        home_latitude=home_lat,
                        home_longitude=home_lng,
                    )
                    db.add(wp)
                    await db.flush()
                    for code, name in [("BP_MONITOR", "BP Monitor"), ("GLUCOMETER", "Glucometer"), ("PULSE_OXIMETER", "Pulse Oximeter"), ("THERMOMETER", "Thermometer"), ("GLOVES", "Disposable Gloves"), ("MASKS", "Surgical Masks")]:
                        db.add(WorkerKitItem(worker_id=wp.id, item_code=code, item_name=name, is_present=True))
                counts[role.value] = counts.get(role.value, 0) + 1

        # 13. Patch 2 — Seed initial WorkerServiceQualification + WorkerServicePreference
        # for the demo workers so the eligibility/opt-in + concurrency flows are
        # testable end-to-end. Idempotent: only creates rows when missing —
        # never overwrites user-driven API changes on subsequent restarts.
        from sqlalchemy import and_ as _and
        demo_worker_phones = ["+919999000002", "+919999000007"]
        for ph in demo_worker_phones:
            wres = await db.execute(
                select(WorkerProfile, User)
                .join(User, User.id == WorkerProfile.user_id)
                .where(User.phone_e164 == ph)
            )
            row = wres.first()
            if not row:
                continue
            wp, _u = row

            async def _seed_qual(target, status: WorkerQualificationStatus, source: WorkerQualificationSource, _wp=wp):
                cond = (
                    WorkerServiceQualification.service_id == target.id
                    if isinstance(target, ServiceCatalogue)
                    else WorkerServiceQualification.package_id == target.id
                )
                q_res = await db.execute(
                    select(WorkerServiceQualification).where(
                        _and(WorkerServiceQualification.worker_id == _wp.id, cond)
                    )
                )
                q = q_res.scalar_one_or_none()
                if not q:
                    q = WorkerServiceQualification(
                        worker_id=_wp.id,
                        service_id=target.id if isinstance(target, ServiceCatalogue) else None,
                        package_id=None if isinstance(target, ServiceCatalogue) else target.id,
                        qualification_status=status,
                        qualification_source=source,
                    )
                    db.add(q)
                    await db.flush()

            async def _seed_pref(target, status: WorkerPreferenceStatus, willing: bool, _wp=wp):
                cond = (
                    WorkerServicePreference.service_id == target.id
                    if isinstance(target, ServiceCatalogue)
                    else WorkerServicePreference.package_id == target.id
                )
                p_res = await db.execute(
                    select(WorkerServicePreference).where(
                        _and(WorkerServicePreference.worker_id == _wp.id, cond)
                    )
                )
                p = p_res.scalar_one_or_none()
                if not p:
                    p = WorkerServicePreference(
                        worker_id=_wp.id,
                        service_id=target.id if isinstance(target, ServiceCatalogue) else None,
                        package_id=None if isinstance(target, ServiceCatalogue) else target.id,
                        preference_status=status,
                        willing_to_accept=willing,
                    )
                    db.add(p)
                    await db.flush()

            # Both workers: APPROVED + OPTED_IN for GENERAL_NURSING (claim race tests)
            await _seed_qual(svc_general, WorkerQualificationStatus.APPROVED, WorkerQualificationSource.TIER)
            await _seed_pref(svc_general, WorkerPreferenceStatus.OPTED_IN, True)

            # Patch 4 — opt the demo workers in for the new services so the
            # workflow engine can be exercised end-to-end. Wound dressing is
            # intentionally OPTED_IN here (overriding the previous opt-out
            # used by claim-race tests in Patch 2) so checklist + wound-photo
            # documentation can be tested.
            await _seed_qual(svc_wound, WorkerQualificationStatus.APPROVED, WorkerQualificationSource.TIER)
            await _seed_pref(svc_wound, WorkerPreferenceStatus.OPTED_IN, True)
            await _seed_qual(svc_baby_bath, WorkerQualificationStatus.APPROVED, WorkerQualificationSource.TIER)
            await _seed_pref(svc_baby_bath, WorkerPreferenceStatus.OPTED_IN, True)
            await _seed_qual(svc_vitals, WorkerQualificationStatus.APPROVED, WorkerQualificationSource.TIER)
            await _seed_pref(svc_vitals, WorkerPreferenceStatus.OPTED_IN, True)
            await _seed_qual(svc_im_inj, WorkerQualificationStatus.APPROVED, WorkerQualificationSource.TIER)
            await _seed_pref(svc_im_inj, WorkerPreferenceStatus.OPTED_IN, True)

            # Both workers: NOT qualified for IV (training required)
            await _seed_qual(svc_iv, WorkerQualificationStatus.TRAINING_REQUIRED, WorkerQualificationSource.TRAINING)

            # Both workers: PICC — pending admin approval, also tier too low
            await _seed_qual(svc_picc, WorkerQualificationStatus.QUALIFIED_PENDING_APPROVAL, WorkerQualificationSource.ADMIN_APPROVAL)

        # Patch 4 — make sure existing service rows point to the new
        # service-specific templates (idempotent re-link). Older versions of
        # the seed pointed these rows to the generic checklist/doc templates.
        from sqlalchemy import update as _sa_update
        await db.execute(
            _sa_update(ServiceCatalogue)
            .where(ServiceCatalogue.service_code == "WOUND_DRESSING")
            .values(
                checklist_template_id=wound_checklist.id,
                documentation_template_id=wound_doc.id,
            )
        )
        await db.execute(
            _sa_update(ServiceCatalogue)
            .where(ServiceCatalogue.service_code == "IV_INFUSION")
            .values(
                checklist_template_id=injection_checklist.id,
                documentation_template_id=injection_doc.id,
            )
        )

        # Patch 4 — re-apply OPTED_IN on the new services in case a previous
        # seed run left them OPTED_OUT. Idempotent.
        await db.execute(
            _sa_update(WorkerServicePreference)
            .where(
                WorkerServicePreference.service_id.in_(
                    [svc_wound.id, svc_baby_bath.id, svc_vitals.id, svc_im_inj.id]
                )
            )
            .values(preference_status=WorkerPreferenceStatus.OPTED_IN, willing_to_accept=True)
        )

        # ------------------------------------------------------------------
        # Patch 4B — Seed standalone assessment modules (separate from the
        # legacy TrainingModule.assessment JSON column).
        # ------------------------------------------------------------------
        from app.models.enums import ContentStatus  # local to avoid top reorder
        # Backfill: ensure every existing training module + template carries a
        # valid lifecycle status. New rows from this seed default to published.
        await db.execute(_sa_update(TrainingModule).where(TrainingModule.status.is_(None)).values(status=ContentStatus.published))
        await db.execute(_sa_update(ChecklistTemplate).where(ChecklistTemplate.status.is_(None)).values(status=ContentStatus.published))
        await db.execute(_sa_update(DocumentationTemplate).where(DocumentationTemplate.status.is_(None)).values(status=ContentStatus.published))

        published_assessment, _ = await _ensure_unique(
            db, AssessmentModule,
            {"code": "IV_INFUSION_ASSESSMENT_V1"},
            {
                "title": "IV Infusion Safety Assessment",
                "description": "Knowledge check covering IV cannulation, infusion-rate calculation, and adverse-event response.",
                "version": 1,
                "pass_score": 70,
                "questions": [
                    {
                        "id": "q1",
                        "type": "single_select",
                        "text": "What is the recommended dwell time for a peripheral IV cannula?",
                        "options": ["12 hours", "72–96 hours", "2 weeks"],
                        "correct_index": 1,
                    },
                    {
                        "id": "q2",
                        "type": "boolean",
                        "text": "You must stop the infusion immediately if you observe extravasation.",
                        "correct_bool": True,
                    },
                    {
                        "id": "q3",
                        "type": "multi_select",
                        "text": "Which checks must be completed BEFORE starting a new infusion?",
                        "options": ["Prescription verified", "Allergy check", "Patient identifier check", "Skip if urgent"],
                        "correct_indices": [0, 1, 2],
                    },
                    {
                        "id": "q4",
                        "type": "text",
                        "text": "Describe your immediate action on suspected anaphylaxis.",
                    },
                ],
                "linked_training_module_code": "IV_INFUSION_V1",
                "status": ContentStatus.published,
                "published_version": 1,
                "is_active": True,
            },
        )

        await _ensure_unique(
            db, AssessmentModule,
            {"code": "PICC_LINE_ASSESSMENT_V1_DRAFT"},
            {
                "title": "PICC Line Care Assessment (Draft)",
                "description": "Draft assessment used to demonstrate the trainer/reviewer workflow.",
                "version": 1,
                "pass_score": 80,
                "questions": [
                    {
                        "id": "q1",
                        "type": "single_select",
                        "text": "Recommended PICC flush solution?",
                        "options": ["Heparin only", "Saline ± heparin per protocol", "Sterile water"],
                        "correct_index": 1,
                    },
                    {
                        "id": "q2",
                        "type": "boolean",
                        "text": "Catheter-related bloodstream infection is suspected when both exit-site redness AND fever are present.",
                        "correct_bool": True,
                    },
                ],
                "linked_training_module_code": "PICC_LINE_V1",
                "status": ContentStatus.draft,
                "is_active": True,
            },
        )

        # Patch 4B — wire the IV service to the published assessment so the
        # qualification engine can be exercised end-to-end. Idempotent.
        await db.execute(
            _sa_update(ServiceCatalogue)
            .where(ServiceCatalogue.service_code == "IV_INFUSION")
            .values(
                required_assessment_codes=["IV_INFUSION_ASSESSMENT_V1"],
                minimum_pass_score=70,
            )
        )

        await db.commit()
    counts["status"] = "ok"
    return counts


def main():
    asyncio.run(seed())


if __name__ == "__main__":
    main()
