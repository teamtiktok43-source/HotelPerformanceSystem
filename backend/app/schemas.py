from datetime import date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class HotelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    commission_rate: Decimal = Field(default=Decimal("0"), ge=0, le=1)
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=1)
    active: bool = True


class HotelUpdate(BaseModel):
    name: str | None = None
    commission_rate: Decimal | None = Field(default=None, ge=0, le=1)
    tax_rate: Decimal | None = Field(default=None, ge=0, le=1)
    active: bool | None = None


class EmployeeCreate(BaseModel):
    username: str
    password: str
    display_name: str
    role: str = "employee"
    active: bool = True


class EmployeeUpdate(BaseModel):
    display_name: str | None = None
    role: str | None = None
    active: bool | None = None
    password: str | None = None


class BookingCreate(BaseModel):
    hotel_id: int
    platform_id: int | None = None
    booking_date: date
    total_bookings: int = Field(ge=0)
    paid_bookings: int = Field(ge=0)
    employee_id: int | None = None


class BookingUpdate(BaseModel):
    hotel_id: int | None = None
    platform_id: int | None = None
    booking_date: date | None = None
    total_bookings: int | None = Field(default=None, ge=0)
    paid_bookings: int | None = Field(default=None, ge=0)
    employee_id: int | None = None


class RevenueCreate(BaseModel):
    booking_number: str
    hotel_id: int
    platform_id: int | None = None
    platform: str
    revenue_date: date
    actual_price: Decimal = Field(ge=0)
    commissionable_amount: Decimal = Field(ge=0)
    employee_id: int | None = None


class RevenueUpdate(BaseModel):
    booking_number: str | None = None
    hotel_id: int | None = None
    platform_id: int | None = None
    platform: str | None = None
    revenue_date: date | None = None
    actual_price: Decimal | None = Field(default=None, ge=0)
    commissionable_amount: Decimal | None = Field(default=None, ge=0)
    employee_id: int | None = None


class ReviewCreate(BaseModel):
    booking_number: str = Field(min_length=1, max_length=120)
    hotel_id: int
    platform_id: int | None = None
    rating: Decimal = Field(ge=0, le=10)
    comment: str = Field(min_length=1)
    sentiment: str = Field(min_length=1, max_length=30)
    review_date: date
    proposed_action: str = ""
    employee_id: int | None = None


class ReviewUpdate(BaseModel):
    booking_number: str | None = Field(default=None, max_length=120)
    hotel_id: int | None = None
    platform_id: int | None = None
    rating: Decimal | None = Field(default=None, ge=0, le=10)
    comment: str | None = None
    sentiment: str | None = None
    review_date: date | None = None
    proposed_action: str | None = None
    employee_id: int | None = None


class ReviewDecision(BaseModel):
    status: str
    rejection_reason: str | None = None


class ReviewCommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    parent_comment_id: int | None = None


class PlatformCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    active: bool = True


class PlatformUpdate(BaseModel):
    name: str | None = None
    active: bool | None = None


class ModelConfig(BaseModel):
    model_config = ConfigDict(from_attributes=True)
