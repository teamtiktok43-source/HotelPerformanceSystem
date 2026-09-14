from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
import os
from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_, text, delete
from sqlalchemy.orm import Session
from .database import Base, engine, get_db
from .models import Booking, Hotel, Platform, Revenue, Review, ReviewComment, Notification, User, SystemLicense, ActivationKey
from .schemas import (BookingCreate, BookingUpdate, EmployeeCreate, EmployeeUpdate, HotelCreate, HotelUpdate,
                      LoginRequest, RevenueCreate, RevenueUpdate, ReviewCreate, ReviewDecision, ReviewUpdate, ReviewCommentCreate, PlatformCreate, PlatformUpdate, LicenseActivateRequest, SmartDailyEntryCreate)
from .auth import create_access_token, decode_access_token, get_current_user, hash_password, verify_password
from .seed import seed_defaults
from .websocket import manager
from .license import SYSTEM_OWNER_USER_ID, DEFAULT_LICENSE_DAYS, generate_activation_key, get_license, hash_activation_key, is_license_active, is_owner, license_to_dict, utcnow, deactivate_license

app = FastAPI(title="Hotel Performance System API", version="1.0.0")

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins or ["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

def ensure_schema_updates():
    inspector = __import__("sqlalchemy").inspect(engine)
    try:
        hotel_columns = {c["name"] for c in inspector.get_columns("hotels")}
        revenue_columns = {c["name"] for c in inspector.get_columns("revenues")}
        booking_columns = {c["name"] for c in inspector.get_columns("bookings")}
        review_columns = {c["name"] for c in inspector.get_columns("reviews")}
    except Exception:
        return

    statements = []
    backend = engine.url.get_backend_name()

    def column_type(name: str) -> str:
        # PostgreSQL does not support DATETIME as a type; SQLite does.
        if name == "updated_at":
            return "DATETIME" if backend == "sqlite" else "TIMESTAMP"
        return ""

    def add_column(table, column, ddl):
        if backend == "sqlite":
            statements.append(f"ALTER TABLE {table} ADD COLUMN {ddl}")
        else:
            statements.append(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {ddl}")

    if "tax_rate" not in hotel_columns:
        add_column("hotels", "tax_rate", "tax_rate NUMERIC(8, 5) NOT NULL DEFAULT 0")
    if "tax_rate" not in revenue_columns:
        add_column("revenues", "tax_rate", "tax_rate NUMERIC(8, 5) NOT NULL DEFAULT 0")
    if "tax" not in revenue_columns:
        add_column("revenues", "tax", "tax NUMERIC(14, 2) NOT NULL DEFAULT 0")
    if "platform_id" not in booking_columns:
        add_column("bookings", "platform_id", "platform_id INTEGER")
    if "platform_id" not in revenue_columns:
        add_column("revenues", "platform_id", "platform_id INTEGER")
    if "platform_id" not in review_columns:
        add_column("reviews", "platform_id", "platform_id INTEGER")
    if "rejection_reason" not in review_columns:
        add_column("reviews", "rejection_reason", "rejection_reason TEXT NOT NULL DEFAULT ''")
    if "updated_at" not in review_columns:
        add_column("reviews", "updated_at", f"updated_at {column_type('updated_at')}")

    if not statements:
        return

    # Run migrations independently so one invalid legacy DDL statement cannot
    # roll back all of the other safe schema upgrades.
    for stmt in statements:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except Exception:
            # Keep startup resilient; the failed column can be retried next run.
            pass

    # Map existing revenue platform text to managed platform IDs where possible.
    try:
        with Session(engine) as db:
            for platform in db.query(Platform).all():
                db.query(Revenue).filter(Revenue.platform_id.is_(None), func.lower(Revenue.platform) == func.lower(platform.name)).update({Revenue.platform_id: platform.id}, synchronize_session=False)
            db.commit()
    except Exception:
        pass

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    ensure_schema_updates()
    with Session(engine) as db:
        seed_defaults(db)
        try:
            for platform in db.query(Platform).all():
                db.query(Revenue).filter(Revenue.platform_id.is_(None), func.lower(Revenue.platform) == func.lower(platform.name)).update({Revenue.platform_id: platform.id}, synchronize_session=False)
            db.commit()
        except Exception:
            db.rollback()


def platform_to_dict(p: Platform):
    return {"id": p.id, "name": p.name, "active": p.active}

def hotel_to_dict(h: Hotel):
    return {"id": h.id, "name": h.name, "commission_rate": float(h.commission_rate or 0), "tax_rate": float(h.tax_rate or 0), "active": h.active}

def user_to_dict(u: User):
    return {"id": u.id, "username": u.username, "display_name": u.display_name, "role": u.role, "active": u.active}

def booking_to_dict(b: Booking):
    return {
        "id": b.id, "hotel_id": b.hotel_id, "hotel_name": b.hotel.name if b.hotel else "", "booking_date": b.booking_date.isoformat(),
        "total_bookings": b.total_bookings, "paid_bookings": b.paid_bookings, "cash_bookings": b.cash_bookings,
        "platform_id": b.platform_id, "platform_name": b.platform.name if b.platform else ("غير محدد" if not b.platform_id else ""),
        "employee_id": b.employee_id, "employee_name": b.employee.display_name if b.employee else "", "created_at": b.created_at.isoformat(),
    }

def revenue_to_dict(r: Revenue):
    return {
        "id": r.id, "booking_number": r.booking_number, "hotel_id": r.hotel_id, "hotel_name": r.hotel.name if r.hotel else "",
        "platform": r.platform, "platform_id": r.platform_id, "platform_name": r.platform_ref.name if r.platform_ref else (r.platform or "غير محدد"), "revenue_date": r.revenue_date.isoformat(), "actual_price": float(r.actual_price or 0),
        "commissionable_amount": float(r.commissionable_amount or 0), "commission_rate": float(r.commission_rate or 0),
        "commission": float(r.commission or 0), "tax_rate": float(r.tax_rate or 0), "tax": float(r.tax or 0), "net_revenue": float(r.net_revenue or 0), "employee_id": r.employee_id,
        "employee_name": r.employee.display_name if r.employee else "", "created_at": r.created_at.isoformat(),
    }

def review_to_dict(r: Review, unread_comment_count: int = 0):
    return {
        "id": r.id, "booking_number": r.booking_number, "hotel_id": r.hotel_id, "hotel_name": r.hotel.name if r.hotel else "",
        "rating": float(r.rating or 0), "comment": r.comment, "platform_id": r.platform_id,
        "platform_name": r.platform.name if r.platform else ("غير محدد" if not r.platform_id else ""),
        "sentiment": r.sentiment, "review_date": r.review_date.isoformat(),
        "proposed_action": r.proposed_action, "employee_id": r.employee_id,
        "employee_name": r.employee.display_name if r.employee else "",
        "status": r.status, "rejection_reason": r.rejection_reason or "",
        "manager_id": r.manager_id, "manager_name": r.manager.display_name if r.manager else "",
        "manager_decided_at": r.manager_decided_at.isoformat() if r.manager_decided_at else None,
        "created_at": r.created_at.isoformat(), "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        "unread_comment_count": unread_comment_count,
    }

def comment_to_dict(c: ReviewComment):
    return {
        "id": c.id, "review_id": c.review_id, "author_id": c.author_id,
        "author_name": c.author.display_name if c.author else "",
        "author_role": c.author.role if c.author else "",
        "content": c.content, "parent_comment_id": c.parent_comment_id,
        "created_at": c.created_at.isoformat(), "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }

def notification_to_dict(n: Notification):
    return {
        "id": n.id, "recipient_id": n.recipient_id, "type": n.type, "title": n.title,
        "message": n.message, "review_id": n.review_id, "comment_id": n.comment_id,
        "is_read": bool(n.is_read), "read_at": n.read_at.isoformat() if n.read_at else None,
        "created_at": n.created_at.isoformat(),
    }

def _authorized_review(review: Review, user: User):
    if user.role in ("admin", "manager") or review.employee_id == user.id:
        return
    raise HTTPException(403, "You do not have access to this review")

def _review_recipients_for_employee(review: Review, db: Session):
    if review.manager_id:
        manager_user = db.get(User, review.manager_id)
        return [manager_user] if manager_user and manager_user.active else []
    return db.query(User).filter(User.active.is_(True), User.role.in_(("manager", "admin"))).all()

def _add_notification(db: Session, recipient_id: int, ntype: str, title: str, message: str, review_id: int | None = None, comment_id: int | None = None):
    n = Notification(
        recipient_id=recipient_id, type=ntype, title=title, message=message,
        review_id=review_id, comment_id=comment_id, is_read=False
    )
    db.add(n)
    return n


@app.get("/")
def root():
    return {"message": "Hotel Performance System API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/api/auth/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(func.lower(User.username) == payload.username.lower()).first()
    if not user or not user.active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    license_row = get_license(db)
    if not is_license_active(license_row) and not is_owner(user.id):
        raise HTTPException(status_code=423, detail="LICENSE_EXPIRED")
    token = create_access_token({"sub": str(user.id), "role": user.role, "username": user.username})
    return {"access_token": token, "token_type": "bearer", "user": user_to_dict(user), "license": license_to_dict(license_row)}

@app.get("/api/auth/me")
def me(user: User = Depends(get_current_user)):
    return user_to_dict(user)

@app.get("/api/system/license")
def system_license(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    license_row = get_license(db)
    return license_to_dict(license_row)


@app.post("/api/system/license/keys", status_code=201)
def create_license_key(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not is_owner(user.id):
        raise HTTPException(status_code=403, detail="System owner required")
    raw_key = generate_activation_key()
    key_row = ActivationKey(
        key_hash=hash_activation_key(raw_key),
        key_preview=raw_key[-8:],
        created_by=user.id,
    )
    db.add(key_row)
    db.commit()
    db.refresh(key_row)
    return {"activation_key": raw_key, "created_at": key_row.created_at.isoformat(), "duration_days": DEFAULT_LICENSE_DAYS}


@app.post("/api/system/license/deactivate")
def deactivate_system_license(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not is_owner(user.id):
        raise HTTPException(status_code=403, detail="System owner required")
    license_row = deactivate_license(db)
    return {"message": "LICENSE_DEACTIVATED", "license": license_to_dict(license_row)}


@app.post("/api/system/license/activate")
def activate_license(payload: LicenseActivateRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not is_owner(user.id):
        raise HTTPException(status_code=403, detail="System owner required")
    normalized_key = payload.activation_key.strip().upper()
    key_row = db.query(ActivationKey).filter(ActivationKey.key_hash == hash_activation_key(normalized_key)).first()
    if not key_row or key_row.used_at is not None:
        raise HTTPException(status_code=400, detail="INVALID_OR_USED_LICENSE_KEY")
    license_row = get_license(db)
    now = utcnow()
    license_row.activated_at = now
    license_row.expires_at = now + __import__("datetime").timedelta(days=DEFAULT_LICENSE_DAYS)
    key_row.used_at = now
    key_row.used_by = user.id
    db.commit()
    db.refresh(license_row)
    return {"message": "LICENSE_ACTIVATED", "license": license_to_dict(license_row)}

@app.get("/api/platforms")
def platforms(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [platform_to_dict(p) for p in db.query(Platform).order_by(Platform.name).all()]

@app.post("/api/platforms", status_code=201)
def create_platform(payload: PlatformCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin or manager required")
    name = payload.name.strip()
    if db.query(Platform).filter(func.lower(Platform.name) == name.lower()).first():
        raise HTTPException(400, "Platform already exists")
    p = Platform(name=name, active=payload.active)
    db.add(p); db.commit(); db.refresh(p)
    return platform_to_dict(p)

@app.patch("/api/platforms/{platform_id}")
def update_platform(platform_id: int, payload: PlatformUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin or manager required")
    p = db.get(Platform, platform_id)
    if not p:
        raise HTTPException(404, "Platform not found")
    if payload.name is not None:
        name = payload.name.strip()
        if not name:
            raise HTTPException(400, "Platform name cannot be empty")
        dup = db.query(Platform).filter(func.lower(Platform.name) == name.lower(), Platform.id != platform_id).first()
        if dup:
            raise HTTPException(400, "Platform already exists")
        p.name = name
    if payload.active is not None:
        p.active = payload.active
    db.commit(); db.refresh(p)
    return platform_to_dict(p)

@app.get("/api/hotels")
def hotels(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [hotel_to_dict(h) for h in db.query(Hotel).order_by(Hotel.name).all()]

@app.post("/api/hotels", status_code=201)
def create_hotel(payload: HotelCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin or manager required")
    if db.query(Hotel).filter(func.lower(Hotel.name) == payload.name.lower()).first():
        raise HTTPException(400, "Hotel already exists")
    h = Hotel(name=payload.name.strip(), commission_rate=payload.commission_rate, tax_rate=payload.tax_rate, active=payload.active)
    db.add(h); db.commit(); db.refresh(h)
    return hotel_to_dict(h)

@app.patch("/api/hotels/{hotel_id}")
def update_hotel(hotel_id: int, payload: HotelUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin or manager required")
    h = db.get(Hotel, hotel_id)
    if not h: raise HTTPException(404, "Hotel not found")
    if payload.name is not None:
        normalized_name = payload.name.strip()
        if not normalized_name:
            raise HTTPException(400, "Hotel name cannot be empty")
        duplicate = (
            db.query(Hotel)
            .filter(func.lower(Hotel.name) == normalized_name.lower(), Hotel.id != hotel_id)
            .first()
        )
        if duplicate:
            raise HTTPException(400, "Hotel already exists")
    for field in ("name", "commission_rate", "tax_rate", "active"):
        value = getattr(payload, field)
        if value is not None: setattr(h, field, value)
    db.commit(); db.refresh(h)
    return hotel_to_dict(h)

@app.get("/api/employees")
def employees(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [user_to_dict(u) for u in db.query(User).order_by(User.display_name).all()]

@app.post("/api/employees", status_code=201)
def create_employee(payload: EmployeeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin": raise HTTPException(403, "Admin required")
    if db.query(User).filter(func.lower(User.username) == payload.username.lower()).first():
        raise HTTPException(400, "Username already exists")
    u = User(username=payload.username.strip(), password_hash=hash_password(payload.password), display_name=payload.display_name.strip(), role=payload.role, active=payload.active)
    db.add(u); db.commit(); db.refresh(u)
    return user_to_dict(u)

@app.patch("/api/employees/{employee_id}")
def update_employee(employee_id: int, payload: EmployeeUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin": raise HTTPException(403, "Admin required")
    u = db.get(User, employee_id)
    if not u: raise HTTPException(404, "Employee not found")
    if employee_id == SYSTEM_OWNER_USER_ID:
        if payload.active is False or (payload.role is not None and payload.role != "admin"):
            raise HTTPException(400, "The system owner account cannot be disabled or changed from admin")
    for field in ("display_name", "role", "active"):
        value = getattr(payload, field)
        if value is not None: setattr(u, field, value)
    if payload.password: u.password_hash = hash_password(payload.password)
    db.commit(); db.refresh(u)
    return user_to_dict(u)

@app.delete("/api/employees/{employee_id}")
def delete_employee(employee_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Admin required")
    if employee_id == user.id:
        raise HTTPException(400, "You cannot delete the account you are currently using")
    u = db.get(User, employee_id)
    if not u:
        raise HTTPException(404, "Employee not found")
    if employee_id == SYSTEM_OWNER_USER_ID:
        raise HTTPException(400, "The system owner account cannot be deleted")

    booking_count = db.query(Booking).filter(Booking.employee_id == employee_id).count()
    revenue_count = db.query(Revenue).filter(Revenue.employee_id == employee_id).count()
    review_count = db.query(Review).filter(Review.employee_id == employee_id).count()
    manager_count = db.query(Review).filter(Review.manager_id == employee_id).count()
    if booking_count or revenue_count or review_count or manager_count:
        raise HTTPException(400, "Cannot delete employee with existing records. Disable the account instead.")

    db.delete(u)
    db.commit()
    return {"deleted": True, "id": employee_id}

@app.post("/api/bookings", status_code=201)
async def create_booking(payload: BookingCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hotel = db.get(Hotel, payload.hotel_id)
    if not hotel or not hotel.active: raise HTTPException(400, "Invalid hotel")
    employee_id = payload.employee_id or user.id
    employee = db.get(User, employee_id)
    if not employee or not employee.active:
        raise HTTPException(400, "Invalid employee")
    platform_id = payload.platform_id
    if platform_id is not None and not db.get(Platform, platform_id):
        raise HTTPException(400, "Invalid platform")
    if payload.paid_bookings > payload.total_bookings: raise HTTPException(400, "Paid bookings cannot exceed total bookings")
    b = Booking(hotel_id=payload.hotel_id, booking_date=payload.booking_date, total_bookings=payload.total_bookings,
                paid_bookings=payload.paid_bookings, cash_bookings=payload.total_bookings-payload.paid_bookings, platform_id=platform_id, employee_id=employee_id)
    db.add(b); db.commit(); db.refresh(b)
    await manager.broadcast({"type": "booking.created", "id": b.id})
    return booking_to_dict(b)

@app.get("/api/bookings")
def list_bookings(start: date | None = None, end: date | None = None, hotel_id: int | None = None,
                  employee_id: int | None = None, platform_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Booking)
    if start: q = q.filter(Booking.booking_date >= start)
    if end: q = q.filter(Booking.booking_date <= end)
    if hotel_id: q = q.filter(Booking.hotel_id == hotel_id)
    if employee_id: q = q.filter(Booking.employee_id == employee_id)
    if platform_id: q = q.filter(Booking.platform_id == platform_id)
    return [booking_to_dict(b) for b in q.order_by(Booking.booking_date.desc(), Booking.id.desc()).all()]

@app.patch("/api/bookings/{booking_id}")
async def update_booking(booking_id: int, payload: BookingUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin or manager required")
    b = db.get(Booking, booking_id)
    if not b:
        raise HTTPException(404, "Booking not found")
    hotel_id = payload.hotel_id if payload.hotel_id is not None else b.hotel_id
    hotel = db.get(Hotel, hotel_id)
    if not hotel or not hotel.active:
        raise HTTPException(400, "Invalid hotel")
    employee_id = payload.employee_id if payload.employee_id is not None else b.employee_id
    platform_id = payload.platform_id if payload.platform_id is not None else b.platform_id
    if platform_id is not None and not db.get(Platform, platform_id):
        raise HTTPException(400, "Invalid platform")
    employee = db.get(User, employee_id)
    if not employee or not employee.active:
        raise HTTPException(400, "Invalid employee")
    total = payload.total_bookings if payload.total_bookings is not None else b.total_bookings
    paid = payload.paid_bookings if payload.paid_bookings is not None else b.paid_bookings
    if paid > total:
        raise HTTPException(400, "Paid bookings cannot exceed total bookings")
    b.hotel_id = hotel_id
    if payload.booking_date is not None: b.booking_date = payload.booking_date
    b.total_bookings = total
    b.paid_bookings = paid
    b.cash_bookings = total - paid
    b.employee_id = employee_id
    b.platform_id = platform_id
    db.commit(); db.refresh(b)
    await manager.broadcast({"type": "booking.updated", "id": b.id})
    return booking_to_dict(b)

@app.delete("/api/bookings/{booking_id}")
async def delete_booking(booking_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin or manager required")
    b = db.get(Booking, booking_id)
    if not b:
        raise HTTPException(404, "Booking not found")
    db.delete(b); db.commit()
    await manager.broadcast({"type": "booking.deleted", "id": booking_id})
    return {"deleted": True, "id": booking_id}

@app.post("/api/revenue", status_code=201)
async def create_revenue(payload: RevenueCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hotel = db.get(Hotel, payload.hotel_id)
    if not hotel or not hotel.active: raise HTTPException(400, "Invalid hotel")
    platform_id = payload.platform_id
    if platform_id is not None and not db.get(Platform, platform_id):
        raise HTTPException(400, "Invalid platform")
    employee_id = payload.employee_id or user.id
    employee = db.get(User, employee_id)
    if not employee or not employee.active:
        raise HTTPException(400, "Invalid employee")
    rate = Decimal(hotel.commission_rate or 0)
    tax_rate = Decimal(hotel.tax_rate or 0)
    commission = (payload.commissionable_amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    tax = (payload.actual_price * tax_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    net = (payload.actual_price - commission - tax).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    r = Revenue(booking_number=payload.booking_number.strip(), hotel_id=payload.hotel_id, platform=(db.get(Platform, platform_id).name if platform_id else payload.platform.strip()), platform_id=platform_id, revenue_date=payload.revenue_date,
                actual_price=payload.actual_price, commissionable_amount=payload.commissionable_amount, commission_rate=rate,
                commission=commission, tax_rate=tax_rate, tax=tax, net_revenue=net, employee_id=employee_id)
    db.add(r); db.commit(); db.refresh(r)
    await manager.broadcast({"type": "revenue.created", "id": r.id})
    return revenue_to_dict(r)


@app.post("/api/smart-entry", status_code=201)
async def create_smart_daily_entry(
    payload: SmartDailyEntryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Atomically distribute one daily batch into bookings, revenues and optional reviews."""
    hotel = db.get(Hotel, payload.hotel_id)
    if not hotel or not hotel.active:
        raise HTTPException(400, "Invalid hotel")

    if user.role not in ("admin", "manager") and payload.employee_id not in (None, user.id):
        raise HTTPException(403, "Employees can only create entries for themselves")
    employee_id = payload.employee_id or user.id
    employee = db.get(User, employee_id)
    if not employee or not employee.active:
        raise HTTPException(400, "Invalid employee")

    cleaned_numbers = [item.booking_number.strip() for item in payload.items]
    if any(not number for number in cleaned_numbers):
        raise HTTPException(400, "Booking number is required")
    normalized_numbers = [number.casefold() for number in cleaned_numbers]
    if len(set(normalized_numbers)) != len(normalized_numbers):
        raise HTTPException(400, "Duplicate booking numbers in the same batch")

    platform_ids = {item.platform_id for item in payload.items}
    platforms = db.query(Platform).filter(Platform.id.in_(platform_ids)).all() if platform_ids else []
    platform_map = {p.id: p for p in platforms if p.active}
    if len(platform_map) != len(platform_ids):
        raise HTTPException(400, "Invalid or inactive platform")

    # A smart entry represents a fresh reservation. Protect revenue data from accidental duplicates.
    existing_revenue = (
        db.query(Revenue.booking_number)
        .filter(func.lower(Revenue.booking_number).in_([number.lower() for number in cleaned_numbers]))
        .first()
    )
    if existing_revenue:
        raise HTTPException(409, f"Booking number already exists in revenue: {existing_revenue[0]}")

    review_numbers = [
        cleaned_numbers[index]
        for index, item in enumerate(payload.items)
        if item.review is not None
    ]
    if review_numbers:
        existing_review = (
            db.query(Review.booking_number)
            .filter(func.lower(Review.booking_number).in_([number.lower() for number in review_numbers]))
            .first()
        )
        if existing_review:
            raise HTTPException(409, f"Booking number already has a review: {existing_review[0]}")

    rate = Decimal(hotel.commission_rate or 0)
    tax_rate = Decimal(hotel.tax_rate or 0)
    grouped: dict[int, dict[str, int]] = {}
    booking_rows: list[Booking] = []
    revenue_rows: list[Revenue] = []
    review_rows: list[Review] = []
    total_actual = Decimal("0")
    total_net = Decimal("0")

    try:
        for index, item in enumerate(payload.items):
            platform = platform_map[item.platform_id]
            booking_number = cleaned_numbers[index]
            counts = grouped.setdefault(item.platform_id, {"paid": 0, "cash": 0})
            if item.payment_status == "Paid":
                counts["paid"] += 1
            else:
                counts["cash"] += 1

            actual_price = Decimal(item.actual_price or 0)
            commissionable = Decimal(item.commissionable_amount if item.commissionable_amount is not None else item.actual_price or 0)
            commission = (commissionable * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            tax = (actual_price * tax_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            net = (actual_price - commission - tax).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            total_actual += actual_price
            total_net += net

            revenue_rows.append(Revenue(
                booking_number=booking_number,
                hotel_id=payload.hotel_id,
                platform=platform.name,
                platform_id=platform.id,
                revenue_date=payload.entry_date,
                actual_price=actual_price,
                commissionable_amount=commissionable,
                commission_rate=rate,
                commission=commission,
                tax_rate=tax_rate,
                tax=tax,
                net_revenue=net,
                employee_id=employee_id,
            ))

            if item.review is not None:
                review_rows.append(Review(
                    booking_number=booking_number,
                    hotel_id=payload.hotel_id,
                    platform_id=platform.id,
                    rating=item.review.rating,
                    comment=item.review.comment.strip(),
                    sentiment=item.review.sentiment,
                    review_date=payload.entry_date,
                    proposed_action=item.review.proposed_action.strip(),
                    employee_id=employee_id,
                    status="Pending",
                    rejection_reason="",
                ))

        for platform_id, counts in grouped.items():
            total = counts["paid"] + counts["cash"]
            booking_rows.append(Booking(
                hotel_id=payload.hotel_id,
                booking_date=payload.entry_date,
                total_bookings=total,
                paid_bookings=counts["paid"],
                cash_bookings=counts["cash"],
                platform_id=platform_id,
                employee_id=employee_id,
            ))

        db.add_all(booking_rows)
        db.add_all(revenue_rows)
        db.add_all(review_rows)
        db.commit()
        for row in [*booking_rows, *revenue_rows, *review_rows]:
            db.refresh(row)
    except Exception:
        db.rollback()
        raise

    for row in booking_rows:
        await manager.broadcast({"type": "booking.created", "id": row.id})
    for row in revenue_rows:
        await manager.broadcast({"type": "revenue.created", "id": row.id})
    for row in review_rows:
        await manager.broadcast({"type": "review.created", "id": row.id})

    return {
        "message": "SMART_ENTRY_CREATED",
        "hotel_id": payload.hotel_id,
        "entry_date": payload.entry_date.isoformat(),
        "reservations": len(payload.items),
        "paid_bookings": sum(1 for item in payload.items if item.payment_status == "Paid"),
        "cash_bookings": sum(1 for item in payload.items if item.payment_status == "Cash"),
        "booking_records": len(booking_rows),
        "revenue_records": len(revenue_rows),
        "review_records": len(review_rows),
        "total_actual_price": float(total_actual.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "total_net_revenue": float(total_net.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)),
        "booking_ids": [row.id for row in booking_rows],
        "revenue_ids": [row.id for row in revenue_rows],
        "review_ids": [row.id for row in review_rows],
    }

@app.get("/api/revenue")
def list_revenue(start: date | None = None, end: date | None = None, hotel_id: int | None = None, employee_id: int | None = None, platform_id: int | None = None,
                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Revenue)
    if start: q = q.filter(Revenue.revenue_date >= start)
    if end: q = q.filter(Revenue.revenue_date <= end)
    if hotel_id: q = q.filter(Revenue.hotel_id == hotel_id)
    if employee_id: q = q.filter(Revenue.employee_id == employee_id)
    if platform_id: q = q.filter(Revenue.platform_id == platform_id)
    return [revenue_to_dict(r) for r in q.order_by(Revenue.revenue_date.desc(), Revenue.id.desc()).all()]

@app.patch("/api/revenue/{revenue_id}")
async def update_revenue(revenue_id: int, payload: RevenueUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin or manager required")
    r = db.get(Revenue, revenue_id)
    if not r:
        raise HTTPException(404, "Revenue not found")
    hotel_id = payload.hotel_id if payload.hotel_id is not None else r.hotel_id
    hotel = db.get(Hotel, hotel_id)
    if not hotel or not hotel.active:
        raise HTTPException(400, "Invalid hotel")
    employee_id = payload.employee_id if payload.employee_id is not None else r.employee_id
    platform_id = payload.platform_id if payload.platform_id is not None else r.platform_id
    if platform_id is not None and not db.get(Platform, platform_id):
        raise HTTPException(400, "Invalid platform")
    employee = db.get(User, employee_id)
    if not employee or not employee.active:
        raise HTTPException(400, "Invalid employee")
    if payload.booking_number is not None: r.booking_number = payload.booking_number.strip()
    r.hotel_id = hotel_id
    if payload.platform is not None: r.platform = payload.platform.strip()
    if platform_id is not None:
        r.platform_id = platform_id
        r.platform = db.get(Platform, platform_id).name
    if payload.revenue_date is not None: r.revenue_date = payload.revenue_date
    if payload.actual_price is not None: r.actual_price = payload.actual_price
    if payload.commissionable_amount is not None: r.commissionable_amount = payload.commissionable_amount
    r.employee_id = employee_id
    rate = Decimal(hotel.commission_rate or 0)
    tax_rate = Decimal(hotel.tax_rate or 0)
    commissionable = Decimal(r.commissionable_amount or 0)
    actual = Decimal(r.actual_price or 0)
    r.commission_rate = rate
    r.commission = (commissionable * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    r.tax_rate = tax_rate
    r.tax = (actual * tax_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    r.net_revenue = (actual - r.commission - r.tax).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    db.commit(); db.refresh(r)
    await manager.broadcast({"type": "revenue.updated", "id": r.id})
    return revenue_to_dict(r)

@app.delete("/api/revenue/{revenue_id}")
async def delete_revenue(revenue_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin or manager required")
    r = db.get(Revenue, revenue_id)
    if not r:
        raise HTTPException(404, "Revenue not found")
    db.delete(r); db.commit()
    await manager.broadcast({"type": "revenue.deleted", "id": revenue_id})
    return {"deleted": True, "id": revenue_id}

@app.post("/api/reviews", status_code=201)
async def create_review(payload: ReviewCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    hotel = db.get(Hotel, payload.hotel_id)
    if not hotel or not hotel.active:
        raise HTTPException(400, "Invalid hotel")
    platform_id = payload.platform_id
    if platform_id is not None:
        platform = db.get(Platform, platform_id)
        if not platform or not platform.active:
            raise HTTPException(400, "Invalid platform")
    if user.role not in ("admin", "manager") and payload.employee_id not in (None, user.id):
        raise HTTPException(403, "Employees can only create reviews for themselves")
    employee_id = payload.employee_id or user.id
    employee = db.get(User, employee_id)
    if not employee or not employee.active:
        raise HTTPException(400, "Invalid employee")
    rv = Review(
        booking_number=payload.booking_number.strip(), hotel_id=payload.hotel_id, platform_id=platform_id,
        rating=payload.rating, comment=payload.comment.strip(), sentiment=payload.sentiment.strip(),
        review_date=payload.review_date, proposed_action=payload.proposed_action.strip(),
        employee_id=employee_id, status="Pending", rejection_reason=""
    )
    db.add(rv)
    db.commit(); db.refresh(rv)
    await manager.broadcast({"type": "review.created", "id": rv.id})
    return review_to_dict(rv)

@app.get("/api/reviews")
def list_reviews(start: date | None = None, end: date | None = None, hotel_id: int | None = None,
                 status: str | None = None, employee_id: int | None = None, platform_id: int | None = None,
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Review)
    if user.role not in ("admin", "manager"):
        q = q.filter(Review.employee_id == user.id)
    elif employee_id:
        q = q.filter(Review.employee_id == employee_id)
    if start: q = q.filter(Review.review_date >= start)
    if end: q = q.filter(Review.review_date <= end)
    if hotel_id: q = q.filter(Review.hotel_id == hotel_id)
    if status: q = q.filter(Review.status == status)
    if platform_id: q = q.filter(Review.platform_id == platform_id)
    reviews = q.order_by(Review.review_date.desc(), Review.id.desc()).all()
    unread_counts = {}
    if reviews:
        ids = [r.id for r in reviews]
        rows = (db.query(Notification.review_id, func.count(Notification.id))
                .filter(Notification.recipient_id == user.id, Notification.is_read.is_(False),
                        Notification.review_id.in_(ids), Notification.comment_id.isnot(None))
                .group_by(Notification.review_id).all())
        unread_counts = {review_id: count for review_id, count in rows}
    return [review_to_dict(r, unread_counts.get(r.id, 0)) for r in reviews]

@app.get("/api/reviews/{review_id}")
def get_review_detail(review_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rv = db.get(Review, review_id)
    if not rv:
        raise HTTPException(404, "Review not found")
    _authorized_review(rv, user)
    comments = db.query(ReviewComment).filter(ReviewComment.review_id == rv.id).order_by(ReviewComment.created_at.asc(), ReviewComment.id.asc()).all()
    unread_comment_ids = {comment_id for (comment_id,) in (
        db.query(Notification.comment_id)
        .filter(Notification.recipient_id == user.id, Notification.is_read.is_(False),
                Notification.review_id == rv.id, Notification.comment_id.isnot(None)).all()
    )}
    return {**review_to_dict(rv, len(unread_comment_ids)), "comments": [{**comment_to_dict(c), "unread": c.id in unread_comment_ids} for c in comments]}

@app.patch("/api/reviews/{review_id}")
async def update_review(review_id: int, payload: ReviewUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin or manager required")
    rv = db.get(Review, review_id)
    if not rv:
        raise HTTPException(404, "Review not found")
    hotel_id = payload.hotel_id if payload.hotel_id is not None else rv.hotel_id
    hotel = db.get(Hotel, hotel_id)
    if not hotel or not hotel.active:
        raise HTTPException(400, "Invalid hotel")
    employee_id = payload.employee_id if payload.employee_id is not None else rv.employee_id
    platform_id = payload.platform_id if payload.platform_id is not None else rv.platform_id
    if platform_id is not None:
        platform = db.get(Platform, platform_id)
        if not platform or not platform.active:
            raise HTTPException(400, "Invalid platform")
    if not db.get(User, employee_id):
        raise HTTPException(400, "Invalid employee")
    if payload.booking_number is not None: rv.booking_number = payload.booking_number.strip()
    rv.hotel_id = hotel_id; rv.platform_id = platform_id
    if payload.rating is not None: rv.rating = payload.rating
    if payload.comment is not None: rv.comment = payload.comment.strip()
    if payload.sentiment is not None: rv.sentiment = payload.sentiment.strip()
    if payload.review_date is not None: rv.review_date = payload.review_date
    if payload.proposed_action is not None: rv.proposed_action = payload.proposed_action.strip()
    rv.employee_id = employee_id
    rv.updated_at = datetime.utcnow()
    db.commit(); db.refresh(rv)
    await manager.broadcast({"type": "review.updated", "id": rv.id})
    return review_to_dict(rv)

@app.delete("/api/reviews/{review_id}")
async def delete_review(review_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin or manager required")
    rv = db.get(Review, review_id)
    if not rv:
        raise HTTPException(404, "Review not found")
    db.query(Notification).filter(Notification.review_id == review_id).delete(synchronize_session=False)
    db.query(ReviewComment).filter(ReviewComment.review_id == review_id).delete(synchronize_session=False)
    db.delete(rv); db.commit()
    await manager.broadcast({"type": "review.deleted", "id": review_id})
    return {"deleted": True, "id": review_id}

@app.patch("/api/reviews/{review_id}/decision")
async def decide_review(review_id: int, payload: ReviewDecision, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Manager required")
    if payload.status not in ("Approved", "Rejected"):
        raise HTTPException(400, "Invalid decision")
    rv = db.get(Review, review_id)
    if not rv:
        raise HTTPException(404, "Review not found")
    reason = (payload.rejection_reason or "").strip()
    if payload.status == "Rejected" and not reason:
        raise HTTPException(400, "Rejection reason is required")
    changed = rv.status != payload.status or (payload.status == "Rejected" and rv.rejection_reason != reason)
    rv.status = payload.status
    rv.rejection_reason = reason if payload.status == "Rejected" else ""
    rv.manager_id = user.id; rv.manager_decided_at = datetime.utcnow(); rv.updated_at = datetime.utcnow()
    if changed:
        title = "تم اعتماد تقييمك" if payload.status == "Approved" else "تم رفض تقييمك"
        if payload.status == "Approved":
            message = f"تم اعتماد تقييم الفندق {rv.hotel.name} بواسطة المدير."
            ntype = "REVIEW_APPROVED"
        else:
            message = f"قام المدير برفض تقييم الفندق {rv.hotel.name}. سبب الرفض: {reason}"
            ntype = "REVIEW_REJECTED"
        _add_notification(db, rv.employee_id, ntype, title, message, review_id=rv.id)
    db.commit(); db.refresh(rv)
    await manager.broadcast({"type": "review.decided", "id": rv.id, "status": rv.status})
    if changed:
        await manager.send_to_user(rv.employee_id, {"type": "notification.created", "review_id": rv.id})
    return review_to_dict(rv)

@app.post("/api/reviews/{review_id}/comments", status_code=201)
async def add_review_comment(review_id: int, payload: ReviewCommentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rv = db.get(Review, review_id)
    if not rv:
        raise HTTPException(404, "Review not found")
    _authorized_review(rv, user)
    content = payload.content.strip()
    if not content:
        raise HTTPException(400, "Comment cannot be empty")
    parent = None
    if payload.parent_comment_id is not None:
        parent = db.get(ReviewComment, payload.parent_comment_id)
        if not parent or parent.review_id != review_id:
            raise HTTPException(400, "Invalid parent comment")
    comment = ReviewComment(review_id=review_id, author_id=user.id, parent_comment_id=payload.parent_comment_id, content=content)
    db.add(comment); db.flush()

    recipients: list[User] = []
    if user.id == rv.employee_id:
        recipients = _review_recipients_for_employee(rv, db)
        ntype = "REVIEW_COMMENT_REPLY" if parent else "REVIEW_COMMENT_ADDED"
        title = "رد جديد على تعليقك" if parent else "تعليق جديد على تقييمك"
        message = "قام الموظف بالرد على تعليقك." if parent else "قام الموظف بإضافة تعليق جديد على التقييم."
    else:
        recipient = db.get(User, rv.employee_id)
        recipients = [recipient] if recipient and recipient.active else []
        ntype = "REVIEW_COMMENT_REPLY" if parent else "REVIEW_COMMENT_ADDED"
        title = "رد جديد على تعليقك" if parent else "تعليق جديد على تقييمك"
        message = "قام المدير بالرد على تعليقك." if parent else "قام المدير بإضافة تعليق جديد على التقييم."
    for recipient in recipients:
        if recipient.id != user.id:
            _add_notification(db, recipient.id, ntype, title, message, review_id=review_id, comment_id=comment.id)

    db.commit(); db.refresh(comment)
    await manager.broadcast({"type": "review.comment.created", "review_id": review_id, "comment_id": comment.id})
    for recipient in recipients:
        if recipient.id != user.id:
            await manager.send_to_user(recipient.id, {"type": "notification.created", "review_id": review_id, "comment_id": comment.id})
    return comment_to_dict(comment)

@app.get("/api/notifications")
def list_notifications(db: Session = Depends(get_db), user: User = Depends(get_current_user), unread_only: bool = False):
    q = db.query(Notification).filter(Notification.recipient_id == user.id)
    if unread_only:
        q = q.filter(Notification.is_read.is_(False))
    return [notification_to_dict(n) for n in q.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(50).all()]

@app.get("/api/notifications/unread-count")
def unread_notification_count(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {"count": db.query(Notification).filter(Notification.recipient_id == user.id, Notification.is_read.is_(False)).count()}

@app.patch("/api/notifications/{notification_id}/read")
def mark_notification_read(notification_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    n = db.get(Notification, notification_id)
    if not n or n.recipient_id != user.id:
        raise HTTPException(404, "Notification not found")
    if not n.is_read:
        n.is_read = True; n.read_at = datetime.utcnow(); db.commit()
    return notification_to_dict(n)

@app.post("/api/notifications/read-all")
def mark_all_notifications_read(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    now = datetime.utcnow()
    count = (db.query(Notification)
             .filter(Notification.recipient_id == user.id, Notification.is_read.is_(False))
             .update({Notification.is_read: True, Notification.read_at: now}, synchronize_session=False))
    db.commit()
    return {"updated": count}

@app.get("/api/ratings")
def ratings(year: int | None = Query(default=None, ge=2000, le=2100), month: int | None = Query(default=None, ge=1, le=12), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    review_query = db.query(Review)
    if year and month:
        start = date(year, month, 1)
        end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
        review_query = review_query.filter(Review.review_date >= start, Review.review_date < end)
    rows = review_query.with_entities(Review.hotel_id, func.count(Review.id), func.avg(Review.rating)).group_by(Review.hotel_id).all()
    sentiment_rows = review_query.with_entities(Review.hotel_id, Review.sentiment, func.count(Review.id)).group_by(Review.hotel_id, Review.sentiment).all()
    summary = {}
    for hotel_id, count, avg in rows:
        h = db.get(Hotel, hotel_id)
        summary[hotel_id] = {"hotel_id": hotel_id, "hotel_name": h.name if h else "", "review_count": count, "average_rating": round(float(avg or 0), 2), "positive": 0, "negative": 0, "pending": 0}
    for hotel_id, sentiment, count in sentiment_rows:
        if hotel_id not in summary: continue
        key = "positive" if sentiment.lower() == "positive" else "negative" if sentiment.lower() == "negative" else "pending"
        summary[hotel_id][key] += count
    return sorted(summary.values(), key=lambda x: (x["average_rating"], x["review_count"]), reverse=True)

@app.get("/api/dashboard")
def dashboard(start: date | None = None, end: date | None = None, hotel_id: int | None = None,
              db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if not start: start = date.today().replace(day=1)
    if not end: end = date.today()
    bq = db.query(Booking).filter(Booking.booking_date.between(start, end))
    rq = db.query(Revenue).filter(Revenue.revenue_date.between(start, end))
    vq = db.query(Review).filter(Review.review_date.between(start, end))
    if hotel_id:
        bq = bq.filter(Booking.hotel_id == hotel_id); rq = rq.filter(Revenue.hotel_id == hotel_id); vq = vq.filter(Review.hotel_id == hotel_id)
    bookings = bq.all(); revenues = rq.all(); reviews = vq.all()
    total_bookings = sum(b.total_bookings for b in bookings)
    paid_bookings = sum(b.paid_bookings for b in bookings)
    cash_bookings = sum(b.cash_bookings for b in bookings)
    actual_revenue = sum((r.actual_price or 0) for r in revenues)
    commission = sum((r.commission or 0) for r in revenues)
    tax = sum((r.tax or 0) for r in revenues)
    net = sum((r.net_revenue or 0) for r in revenues)
    avg_rating = (sum((r.rating or 0) for r in reviews) / len(reviews)) if reviews else 0
    revenue_by_hotel = {}
    for r in revenues:
        revenue_by_hotel.setdefault(r.hotel.name, 0); revenue_by_hotel[r.hotel.name] += float(r.net_revenue or 0)
    paid_cash = [{"name": "Paid", "value": paid_bookings}, {"name": "Cash", "value": cash_bookings}]
    sentiment = {}
    for r in reviews:
        sentiment[r.sentiment] = sentiment.get(r.sentiment, 0) + 1
    sentiment_chart = [{"name": k, "value": v} for k, v in sorted(sentiment.items())] or [{"name": "Positive", "value": 0}, {"name": "Negative", "value": 0}]
    revenue_chart = [{"name": k, "value": round(v, 2)} for k, v in sorted(revenue_by_hotel.items(), key=lambda kv: kv[1], reverse=True)[:10]] or [{"name": "No Data", "value": 0}]
    top_hotel = max(revenue_by_hotel.items(), key=lambda x: x[1])[0] if revenue_by_hotel else "-"
    def platform_breakdown(records, value_getter):
        totals = {}
        for rec in records:
            # Booking and Review store the platform as a SQLAlchemy relationship
            # named `platform`, while Revenue keeps the legacy platform text in
            # `platform` and the normalized relation in `platform_ref`.
            if isinstance(rec, Revenue):
                platform_obj = getattr(rec, "platform_ref", None)
                platform_name = platform_obj.name if platform_obj else (rec.platform or "غير محدد")
            else:
                platform_obj = getattr(rec, "platform", None)
                platform_name = platform_obj.name if platform_obj else "غير محدد"

            platform_name = platform_name or "غير محدد"
            totals[platform_name] = totals.get(platform_name, 0) + float(value_getter(rec) or 0)

        total = sum(totals.values())
        return [
            {
                "platform": k,
                "value": round(v, 2),
                "percentage": round((v / total) * 100, 1) if total else 0,
            }
            for k, v in sorted(totals.items(), key=lambda kv: kv[1], reverse=True)
        ]

    platform_chart = {
        "bookings": platform_breakdown(bookings, lambda x: x.total_bookings),
        "reviews": platform_breakdown(reviews, lambda x: 1),
        "revenue": platform_breakdown(revenues, lambda x: x.actual_price),
    }
    hotel_perf = []
    grouped = {}
    for b in bookings: grouped.setdefault(b.hotel.name, {"bookings": 0, "paid": 0, "cash": 0}); grouped[b.hotel.name]["bookings"] += b.total_bookings; grouped[b.hotel.name]["paid"] += b.paid_bookings; grouped[b.hotel.name]["cash"] += b.cash_bookings
    for name, vals in grouped.items(): hotel_perf.append({"hotel": name, **vals})
    return {
        "filters": {"start": start.isoformat(), "end": end.isoformat(), "hotel_id": hotel_id},
        "kpis": {"reviews": len(reviews), "bookings": total_bookings, "paid_bookings": paid_bookings, "cash_bookings": cash_bookings,
                 "actual_revenue": float(actual_revenue), "commission": float(commission), "tax": float(tax), "net_revenue": float(net), "average_rating": round(float(avg_rating), 2)},
        "revenue_by_hotel": revenue_chart, "paid_cash": paid_cash, "sentiment": sentiment_chart, "platform_breakdown": platform_chart,
        "top_hotel": top_hotel, "hotel_performance": hotel_perf,
    }

@app.get("/api/monthly-report")
def monthly_report(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2000, le=2100),
    hotel_id: int | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    def month_bounds(y: int, m: int):
        start = date(y, m, 1)
        if m == 12:
            end = date(y + 1, 1, 1)
        else:
            end = date(y, m + 1, 1)
        return start, end

    def previous_month(y: int, m: int):
        return (y - 1, 12) if m == 1 else (y, m - 1)

    def build_rows(y: int, m: int):
        start, end = month_bounds(y, m)
        bq = db.query(Booking).filter(Booking.booking_date >= start, Booking.booking_date < end)
        rq = db.query(Revenue).filter(Revenue.revenue_date >= start, Revenue.revenue_date < end)
        vq = db.query(Review).filter(Review.review_date >= start, Review.review_date < end)
        if hotel_id:
            bq = bq.filter(Booking.hotel_id == hotel_id)
            rq = rq.filter(Revenue.hotel_id == hotel_id)
            vq = vq.filter(Review.hotel_id == hotel_id)

        bookings = bq.all()
        revenues = rq.all()
        reviews = vq.all()

        hotels_query = db.query(Hotel).order_by(Hotel.name)
        if hotel_id:
            hotels_query = hotels_query.filter(Hotel.id == hotel_id)
        hotels = hotels_query.all()

        rows = []
        for h in hotels:
            hb = [b for b in bookings if b.hotel_id == h.id]
            hr = [r for r in revenues if r.hotel_id == h.id]
            hv = [v for v in reviews if v.hotel_id == h.id]
            rows.append({
                "hotel_id": h.id,
                "hotel_name": h.name,
                "bookings": sum(b.total_bookings for b in hb),
                "paid": sum(b.paid_bookings for b in hb),
                "cash": sum(b.cash_bookings for b in hb),
                "actual_revenue": round(sum(float(r.actual_price or 0) for r in hr), 2),
                "commission": round(sum(float(r.commission or 0) for r in hr), 2),
                "tax": round(sum(float(r.tax or 0) for r in hr), 2),
                "net_revenue": round(sum(float(r.net_revenue or 0) for r in hr), 2),
                "review_count": len(hv),
                "average_rating": round(sum(float(v.rating or 0) for v in hv) / len(hv), 2) if hv else 0,
            })
        rows.sort(key=lambda x: x["net_revenue"], reverse=True)

        platform_breakdown = {
            "bookings": [], "reviews": [], "revenue": []
        }
        def _platform_group(records, value_getter):
            grouped = {}
            for rec in records:
                name = None
                if isinstance(rec, Revenue):
                    name = rec.platform_ref.name if rec.platform_ref else (rec.platform or "غير محدد")
                else:
                    rel = getattr(rec, "platform", None)
                    name = rel.name if rel else "غير محدد"
                grouped[name] = grouped.get(name, 0) + float(value_getter(rec) or 0)
            total = sum(grouped.values())
            return [{"platform": k, "value": round(v,2), "percentage": round((v/total)*100,1) if total else 0} for k,v in sorted(grouped.items(), key=lambda kv: kv[1], reverse=True)]
        platform_breakdown["bookings"] = _platform_group(bookings, lambda x:x.total_bookings)
        platform_breakdown["reviews"] = _platform_group(reviews, lambda x:1)
        platform_breakdown["revenue"] = _platform_group(revenues, lambda x:x.actual_price)

        totals = {
            "bookings": sum(r["bookings"] for r in rows),
            "paid": sum(r["paid"] for r in rows),
            "cash": sum(r["cash"] for r in rows),
            "actual_revenue": round(sum(r["actual_revenue"] for r in rows), 2),
            "commission": round(sum(r["commission"] for r in rows), 2),
            "tax": round(sum(r["tax"] for r in rows), 2),
            "net_revenue": round(sum(r["net_revenue"] for r in rows), 2),
            "reviews": sum(r["review_count"] for r in rows),
            "average_rating": round(
                sum(r["average_rating"] for r in rows if r["review_count"])
                / len([r for r in rows if r["review_count"]]), 2
            ) if any(r["review_count"] for r in rows) else 0,
        }
        return {"rows": rows, "totals": totals, "platform_breakdown": platform_breakdown, "start": start.isoformat(), "end": end.isoformat()}

    previous_year, previous_month_number = previous_month(year, month)
    current = build_rows(year, month)
    previous = build_rows(previous_year, previous_month_number)

    return {
        "year": year,
        "month": month,
        "start": current["start"],
        "end": current["end"],
        "hotel_id": hotel_id,
        "rows": current["rows"],
        "totals": current["totals"],
        "platform_breakdown": current["platform_breakdown"],
        "previous": {
            "year": previous_year,
            "month": previous_month_number,
            "start": previous["start"],
            "end": previous["end"],
            "rows": previous["rows"],
            "totals": previous["totals"],
            "platform_breakdown": previous["platform_breakdown"],
        },
    }

@app.get("/api/data")
def all_data(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return {"bookings": [booking_to_dict(x) for x in db.query(Booking).order_by(Booking.id.desc()).all()],
            "revenues": [revenue_to_dict(x) for x in db.query(Revenue).order_by(Revenue.id.desc()).all()],
            "reviews": [review_to_dict(x) for x in db.query(Review).order_by(Review.id.desc()).all()]}

@app.delete("/api/data/month")
async def delete_data_month(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin or manager required")

    start_date = date(year, month, 1)
    end_date = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)

    review_ids = [row[0] for row in db.query(Review.id).filter(Review.review_date >= start_date, Review.review_date < end_date).all()]
    if review_ids:
        db.query(Notification).filter(Notification.review_id.in_(review_ids)).delete(synchronize_session=False)
        db.query(ReviewComment).filter(ReviewComment.review_id.in_(review_ids)).delete(synchronize_session=False)
    booking_count = db.query(Booking).filter(Booking.booking_date >= start_date, Booking.booking_date < end_date).delete(synchronize_session=False)
    revenue_count = db.query(Revenue).filter(Revenue.revenue_date >= start_date, Revenue.revenue_date < end_date).delete(synchronize_session=False)
    review_count = db.query(Review).filter(Review.review_date >= start_date, Review.review_date < end_date).delete(synchronize_session=False)
    db.commit()

    result = {
        "deleted": True,
        "year": year,
        "month": month,
        "counts": {
            "bookings": booking_count,
            "revenues": revenue_count,
            "reviews": review_count,
        },
        "total": booking_count + revenue_count + review_count,
    }
    await manager.broadcast({"type": "data.month_deleted", **result})
    return result

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=1008)
        return
    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub"))
    except Exception:
        await websocket.close(code=1008)
        return
    await manager.connect(websocket, user_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)
