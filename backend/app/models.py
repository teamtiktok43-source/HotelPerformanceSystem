from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(300))
    role: Mapped[str] = mapped_column(String(30), default="employee")
    display_name: Mapped[str] = mapped_column(String(120))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Hotel(Base):
    __tablename__ = "hotels"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(8, 5), default=Decimal("0"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), index=True)
    booking_date: Mapped[date] = mapped_column(Date, index=True)
    total_bookings: Mapped[int] = mapped_column(Integer, default=0)
    paid_bookings: Mapped[int] = mapped_column(Integer, default=0)
    cash_bookings: Mapped[int] = mapped_column(Integer, default=0)
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    hotel: Mapped["Hotel"] = relationship()
    employee: Mapped["User"] = relationship()

class Revenue(Base):
    __tablename__ = "revenues"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_number: Mapped[str] = mapped_column(String(120), index=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), index=True)
    platform: Mapped[str] = mapped_column(String(80), default="Direct")
    revenue_date: Mapped[date] = mapped_column(Date, index=True)
    actual_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    commissionable_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(8, 5), default=Decimal("0"))
    commission: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    net_revenue: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    hotel: Mapped["Hotel"] = relationship()
    employee: Mapped["User"] = relationship()

class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_number: Mapped[str] = mapped_column(String(120), index=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), index=True)
    rating: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=Decimal("0"))
    comment: Mapped[str] = mapped_column(Text, default="")
    sentiment: Mapped[str] = mapped_column(String(30), default="Positive")
    review_date: Mapped[date] = mapped_column(Date, index=True)
    proposed_action: Mapped[str] = mapped_column(Text, default="")
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="Pending", index=True)
    manager_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    manager_decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    hotel: Mapped["Hotel"] = relationship()
    employee: Mapped["User"] = relationship(foreign_keys=[employee_id])
    manager: Mapped["User"] = relationship(foreign_keys=[manager_id])
