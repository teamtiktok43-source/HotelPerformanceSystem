from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from .models import ActivationKey, SystemLicense

SYSTEM_OWNER_USER_ID = 1
DEFAULT_LICENSE_DAYS = 30
DEFAULT_RENEWAL_PRICE = Decimal("20.00")
DEFAULT_RENEWAL_CURRENCY = "USD"
DEFAULT_SUSPENSION_TITLE = "Service Temporarily Suspended"
DEFAULT_SUSPENSION_MESSAGE = (
    "The Hotel Performance System subscription is currently inactive. "
    "Please contact the system administrator to restore access."
)
ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hash_activation_key(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def generate_activation_key() -> str:
    chunks = ["".join(secrets.choice(ALPHABET) for _ in range(4)) for _ in range(4)]
    return "HPS-" + "-".join(chunks)


def is_owner(user_id: int) -> bool:
    return user_id == SYSTEM_OWNER_USER_ID


def get_license(db: Session) -> SystemLicense:
    license_row = db.get(SystemLicense, 1)
    if license_row is None:
        license_row = SystemLicense(
            id=1,
            activated_at=utcnow(),
            expires_at=utcnow() + timedelta(days=DEFAULT_LICENSE_DAYS),
            renewal_price=DEFAULT_RENEWAL_PRICE,
            renewal_currency=DEFAULT_RENEWAL_CURRENCY,
            suspension_title=DEFAULT_SUSPENSION_TITLE,
            suspension_message=DEFAULT_SUSPENSION_MESSAGE,
        )
        db.add(license_row)
        db.commit()
        db.refresh(license_row)
    return license_row


def is_license_active(license_row: SystemLicense, now: datetime | None = None) -> bool:
    current = now or utcnow()
    return bool(license_row.expires_at and license_row.expires_at > current)


def deactivate_license(db: Session) -> SystemLicense:
    license_row = get_license(db)
    license_row.expires_at = utcnow()
    db.commit()
    db.refresh(license_row)
    return license_row


def _settings(license_row: SystemLicense) -> dict:
    return {
        "renewal_price": float(license_row.renewal_price or DEFAULT_RENEWAL_PRICE),
        "renewal_currency": (license_row.renewal_currency or DEFAULT_RENEWAL_CURRENCY).upper(),
        "suspension_title": license_row.suspension_title or DEFAULT_SUSPENSION_TITLE,
        "suspension_message": license_row.suspension_message or DEFAULT_SUSPENSION_MESSAGE,
    }


def public_license_to_dict(license_row: SystemLicense) -> dict:
    return {"active": is_license_active(license_row), **_settings(license_row)}


def license_to_dict(license_row: SystemLicense) -> dict:
    now = utcnow()
    active = is_license_active(license_row, now)
    remaining_seconds = max(0, int((license_row.expires_at - now).total_seconds())) if license_row.expires_at else 0
    remaining_days = (remaining_seconds + 86399) // 86400
    return {
        "active": active,
        "activated_at": license_row.activated_at.isoformat() if license_row.activated_at else None,
        "expires_at": license_row.expires_at.isoformat() if license_row.expires_at else None,
        "remaining_days": remaining_days,
        "remaining_seconds": remaining_seconds,
        "owner_user_id": SYSTEM_OWNER_USER_ID,
        **_settings(license_row),
    }
