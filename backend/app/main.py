from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
import os
from fastapi import Depends, FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from .database import Base, engine, get_db
from .models import Booking, Hotel, Revenue, Review, User
from .schemas import (BookingCreate, BookingUpdate, EmployeeCreate, EmployeeUpdate, HotelCreate, HotelUpdate,
                      LoginRequest, RevenueCreate, RevenueUpdate, ReviewCreate, ReviewDecision, ReviewUpdate)
from .auth import create_access_token, decode_access_token, get_current_user, hash_password, verify_password
from .seed import seed_defaults
from .websocket import manager

app = FastAPI(title="Hotel Performance System API", version="1.0.0")

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins or ["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    with Session(engine) as db:
        seed_defaults(db)


def hotel_to_dict(h: Hotel):
    return {"id": h.id, "name": h.name, "commission_rate": float(h.commission_rate or 0), "active": h.active}

def user_to_dict(u: User):
    return {"id": u.id, "username": u.username, "display_name": u.display_name, "role": u.role, "active": u.active}

def booking_to_dict(b: Booking):
    return {
        "id": b.id, "hotel_id": b.hotel_id, "hotel_name": b.hotel.name if b.hotel else "", "booking_date": b.booking_date.isoformat(),
        "total_bookings": b.total_bookings, "paid_bookings": b.paid_bookings, "cash_bookings": b.cash_bookings,
        "employee_id": b.employee_id, "employee_name": b.employee.display_name if b.employee else "", "created_at": b.created_at.isoformat(),
    }

def revenue_to_dict(r: Revenue):
    return {
        "id": r.id, "booking_number": r.booking_number, "hotel_id": r.hotel_id, "hotel_name": r.hotel.name if r.hotel else "",
        "platform": r.platform, "revenue_date": r.revenue_date.isoformat(), "actual_price": float(r.actual_price or 0),
        "commissionable_amount": float(r.commissionable_amount or 0), "commission_rate": float(r.commission_rate or 0),
        "commission": float(r.commission or 0), "net_revenue": float(r.net_revenue or 0), "employee_id": r.employee_id,
        "employee_name": r.employee.display_name if r.employee else "", "created_at": r.created_at.isoformat(),
    }

def review_to_dict(r: Review):
    return {
        "id": r.id, "booking_number": r.booking_number, "hotel_id": r.hotel_id, "hotel_name": r.hotel.name if r.hotel else "",
        "rating": float(r.rating or 0), "comment": r.comment, "sentiment": r.sentiment, "review_date": r.review_date.isoformat(),
        "proposed_action": r.proposed_action, "employee_id": r.employee_id, "employee_name": r.employee.display_name if r.employee else "",
        "status": r.status, "manager_id": r.manager_id, "manager_name": r.manager.display_name if r.manager else "",
        "manager_decided_at": r.manager_decided_at.isoformat() if r.manager_decided_at else None,
        "created_at": r.created_at.isoformat(),
    }

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
    token = create_access_token({"sub": str(user.id), "role": user.role, "username": user.username})
    return {"access_token": token, "token_type": "bearer", "user": user_to_dict(user)}

@app.get("/api/auth/me")
def me(user: User = Depends(get_current_user)):
    return user_to_dict(user)

@app.get("/api/hotels")
def hotels(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [hotel_to_dict(h) for h in db.query(Hotel).order_by(Hotel.name).all()]

@app.post("/api/hotels", status_code=201)
def create_hotel(payload: HotelCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("admin", "manager"):
        raise HTTPException(403, "Admin or manager required")
    if db.query(Hotel).filter(func.lower(Hotel.name) == payload.name.lower()).first():
        raise HTTPException(400, "Hotel already exists")
    h = Hotel(name=payload.name.strip(), commission_rate=payload.commission_rate, active=payload.active)
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
    for field in ("name", "commission_rate", "active"):
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
    if payload.paid_bookings > payload.total_bookings: raise HTTPException(400, "Paid bookings cannot exceed total bookings")
    b = Booking(hotel_id=payload.hotel_id, booking_date=payload.booking_date, total_bookings=payload.total_bookings,
                paid_bookings=payload.paid_bookings, cash_bookings=payload.total_bookings-payload.paid_bookings, employee_id=employee_id)
    db.add(b); db.commit(); db.refresh(b)
    await manager.broadcast({"type": "booking.created", "id": b.id})
    return booking_to_dict(b)

@app.get("/api/bookings")
def list_bookings(start: date | None = None, end: date | None = None, hotel_id: int | None = None,
                  employee_id: int | None = None, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Booking)
    if start: q = q.filter(Booking.booking_date >= start)
    if end: q = q.filter(Booking.booking_date <= end)
    if hotel_id: q = q.filter(Booking.hotel_id == hotel_id)
    if employee_id: q = q.filter(Booking.employee_id == employee_id)
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
    if not db.get(User, employee_id):
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
    rate = Decimal(hotel.commission_rate or 0)
    commission = (payload.commissionable_amount * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    net = (payload.actual_price - commission).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    r = Revenue(booking_number=payload.booking_number.strip(), hotel_id=payload.hotel_id, platform=payload.platform.strip(), revenue_date=payload.revenue_date,
                actual_price=payload.actual_price, commissionable_amount=payload.commissionable_amount, commission_rate=rate,
                commission=commission, net_revenue=net, employee_id=payload.employee_id or user.id)
    db.add(r); db.commit(); db.refresh(r)
    await manager.broadcast({"type": "revenue.created", "id": r.id})
    return revenue_to_dict(r)

@app.get("/api/revenue")
def list_revenue(start: date | None = None, end: date | None = None, hotel_id: int | None = None, employee_id: int | None = None,
                db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Revenue)
    if start: q = q.filter(Revenue.revenue_date >= start)
    if end: q = q.filter(Revenue.revenue_date <= end)
    if hotel_id: q = q.filter(Revenue.hotel_id == hotel_id)
    if employee_id: q = q.filter(Revenue.employee_id == employee_id)
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
    if not db.get(User, employee_id):
        raise HTTPException(400, "Invalid employee")
    if payload.booking_number is not None: r.booking_number = payload.booking_number.strip()
    r.hotel_id = hotel_id
    if payload.platform is not None: r.platform = payload.platform.strip()
    if payload.revenue_date is not None: r.revenue_date = payload.revenue_date
    if payload.actual_price is not None: r.actual_price = payload.actual_price
    if payload.commissionable_amount is not None: r.commissionable_amount = payload.commissionable_amount
    r.employee_id = employee_id
    rate = Decimal(hotel.commission_rate or 0)
    commissionable = Decimal(r.commissionable_amount or 0)
    actual = Decimal(r.actual_price or 0)
    r.commission_rate = rate
    r.commission = (commissionable * rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    r.net_revenue = (actual - r.commission).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
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
    if not hotel or not hotel.active: raise HTTPException(400, "Invalid hotel")
    rv = Review(booking_number=payload.booking_number.strip(), hotel_id=payload.hotel_id, rating=payload.rating, comment=payload.comment.strip(),
                sentiment=payload.sentiment, review_date=payload.review_date, proposed_action=payload.proposed_action.strip(),
                employee_id=payload.employee_id or user.id, status="Pending")
    db.add(rv); db.commit(); db.refresh(rv)
    await manager.broadcast({"type": "review.created", "id": rv.id})
    return review_to_dict(rv)

@app.get("/api/reviews")
def list_reviews(start: date | None = None, end: date | None = None, hotel_id: int | None = None,
                 status: str | None = None, employee_id: int | None = None,
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = db.query(Review)
    if start: q = q.filter(Review.review_date >= start)
    if end: q = q.filter(Review.review_date <= end)
    if hotel_id: q = q.filter(Review.hotel_id == hotel_id)
    if status: q = q.filter(Review.status == status)
    if employee_id: q = q.filter(Review.employee_id == employee_id)
    return [review_to_dict(r) for r in q.order_by(Review.review_date.desc(), Review.id.desc()).all()]

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
    if not db.get(User, employee_id):
        raise HTTPException(400, "Invalid employee")
    if payload.booking_number is not None: rv.booking_number = payload.booking_number.strip()
    rv.hotel_id = hotel_id
    if payload.rating is not None: rv.rating = payload.rating
    if payload.comment is not None: rv.comment = payload.comment.strip()
    if payload.sentiment is not None: rv.sentiment = payload.sentiment
    if payload.review_date is not None: rv.review_date = payload.review_date
    if payload.proposed_action is not None: rv.proposed_action = payload.proposed_action.strip()
    rv.employee_id = employee_id
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
    db.delete(rv); db.commit()
    await manager.broadcast({"type": "review.deleted", "id": review_id})
    return {"deleted": True, "id": review_id}

@app.patch("/api/reviews/{review_id}/decision")
async def decide_review(review_id: int, payload: ReviewDecision, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if user.role not in ("admin", "manager"): raise HTTPException(403, "Manager required")
    if payload.status not in ("Approved", "Rejected"): raise HTTPException(400, "Invalid decision")
    rv = db.get(Review, review_id)
    if not rv: raise HTTPException(404, "Review not found")
    rv.status = payload.status; rv.manager_id = user.id; rv.manager_decided_at = datetime.utcnow()
    db.commit(); db.refresh(rv)
    await manager.broadcast({"type": "review.decided", "id": rv.id, "status": rv.status})
    return review_to_dict(rv)

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
    hotel_perf = []
    grouped = {}
    for b in bookings: grouped.setdefault(b.hotel.name, {"bookings": 0, "paid": 0, "cash": 0}); grouped[b.hotel.name]["bookings"] += b.total_bookings; grouped[b.hotel.name]["paid"] += b.paid_bookings; grouped[b.hotel.name]["cash"] += b.cash_bookings
    for name, vals in grouped.items(): hotel_perf.append({"hotel": name, **vals})
    return {
        "filters": {"start": start.isoformat(), "end": end.isoformat(), "hotel_id": hotel_id},
        "kpis": {"reviews": len(reviews), "bookings": total_bookings, "paid_bookings": paid_bookings, "cash_bookings": cash_bookings,
                 "actual_revenue": float(actual_revenue), "commission": float(commission), "net_revenue": float(net), "average_rating": round(float(avg_rating), 2)},
        "revenue_by_hotel": revenue_chart, "paid_cash": paid_cash, "sentiment": sentiment_chart,
        "top_hotel": top_hotel, "hotel_performance": hotel_perf,
    }

@app.get("/api/monthly-report")
def monthly_report(month: int = Query(..., ge=1, le=12), year: int = Query(..., ge=2000, le=2100), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    bookings = db.query(Booking).filter(Booking.booking_date >= start, Booking.booking_date < end).all()
    revenues = db.query(Revenue).filter(Revenue.revenue_date >= start, Revenue.revenue_date < end).all()
    reviews = db.query(Review).filter(Review.review_date >= start, Review.review_date < end).all()
    hotels = db.query(Hotel).all()
    rows = []
    for h in hotels:
        hb = [b for b in bookings if b.hotel_id == h.id]
        hr = [r for r in revenues if r.hotel_id == h.id]
        hv = [v for v in reviews if v.hotel_id == h.id]
        rows.append({"hotel_name": h.name, "bookings": sum(b.total_bookings for b in hb), "paid": sum(b.paid_bookings for b in hb),
                     "cash": sum(b.cash_bookings for b in hb), "actual_revenue": round(sum(float(r.actual_price) if r.actual_price is not None else 0.0 for r in hr), 2),
                     "commission": round(sum(float(r.commission) if r.commission is not None else 0.0 for r in hr), 2), "net_revenue": round(sum(float(r.net_revenue) if r.net_revenue is not None else 0.0 for r in hr), 2),
                     "review_count": len(hv), "average_rating": round(sum(float(v.rating or 0) for v in hv)/len(hv), 2) if hv else 0})
    rows.sort(key=lambda x: x["net_revenue"], reverse=True)
    return {"year": year, "month": month, "start": start.isoformat(), "end": end.isoformat(), "rows": rows,
            "totals": {"bookings": sum(r["bookings"] for r in rows), "paid": sum(r["paid"] for r in rows), "cash": sum(r["cash"] for r in rows),
                       "actual_revenue": round(sum(r["actual_revenue"] for r in rows), 2), "commission": round(sum(r["commission"] for r in rows), 2),
                       "net_revenue": round(sum(r["net_revenue"] for r in rows), 2), "reviews": sum(r["review_count"] for r in rows),
                       "average_rating": round(sum(r["average_rating"] for r in rows if r["review_count"])/len([r for r in rows if r["review_count"]]), 2) if any(r["review_count"] for r in rows) else 0}}

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
        decode_access_token(token)
    except Exception:
        await websocket.close(code=1008)
        return
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception:
        await manager.disconnect(websocket)
