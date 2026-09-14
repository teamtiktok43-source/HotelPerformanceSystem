from datetime import date, datetime
from decimal import Decimal
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text
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


class SystemLicense(Base):
    __tablename__ = "system_license"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ActivationKey(Base):
    __tablename__ = "activation_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    key_preview: Mapped[str] = mapped_column(String(19))
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    used_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)



class Platform(Base):
    __tablename__ = "platforms"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Hotel(Base):
    __tablename__ = "hotels"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(8, 5), default=Decimal("0"))
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(8, 5), default=Decimal("0"))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), index=True)
    booking_date: Mapped[date] = mapped_column(Date, index=True)
    total_bookings: Mapped[int] = mapped_column(Integer, default=0)
    paid_bookings: Mapped[int] = mapped_column(Integer, default=0)
    cash_bookings: Mapped[int] = mapped_column(Integer, default=0)
    platform_id: Mapped[int | None] = mapped_column(ForeignKey("platforms.id"), index=True, nullable=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    hotel: Mapped["Hotel"] = relationship()
    platform: Mapped["Platform"] = relationship()
    employee: Mapped["User"] = relationship()


class Revenue(Base):
    __tablename__ = "revenues"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    booking_number: Mapped[str] = mapped_column(String(120), index=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), index=True)
    platform: Mapped[str] = mapped_column(String(80), default="Direct")
    platform_id: Mapped[int | None] = mapped_column(ForeignKey("platforms.id"), index=True, nullable=True)
    revenue_date: Mapped[date] = mapped_column(Date, index=True)
    actual_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    commissionable_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    commission_rate: Mapped[Decimal] = mapped_column(Numeric(8, 5), default=Decimal("0"))
    commission: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    tax_rate: Mapped[Decimal] = mapped_column(Numeric(8, 5), default=Decimal("0"))
    tax: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    net_revenue: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    hotel: Mapped["Hotel"] = relationship()
    platform_ref: Mapped["Platform"] = relationship(foreign_keys=[platform_id])
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
    platform_id: Mapped[int | None] = mapped_column(ForeignKey("platforms.id"), index=True, nullable=True)
    proposed_action: Mapped[str] = mapped_column(Text, default="")
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="Pending", index=True)
    rejection_reason: Mapped[str] = mapped_column(Text, default="")
    manager_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    manager_decided_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    hotel: Mapped["Hotel"] = relationship()
    platform: Mapped["Platform"] = relationship(foreign_keys=[platform_id])
    employee: Mapped["User"] = relationship(foreign_keys=[employee_id])
    manager: Mapped["User"] = relationship(foreign_keys=[manager_id])
    comments: Mapped[list["ReviewComment"]] = relationship(
        back_populates="review", cascade="all, delete-orphan", passive_deletes=True, order_by="ReviewComment.created_at"
    )


class ReviewComment(Base):
    __tablename__ = "review_comments"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    parent_comment_id: Mapped[int | None] = mapped_column(ForeignKey("review_comments.id", ondelete="SET NULL"), nullable=True, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    review: Mapped["Review"] = relationship(back_populates="comments")
    author: Mapped["User"] = relationship(foreign_keys=[author_id])
    parent: Mapped["ReviewComment | None"] = relationship(remote_side=[id], back_populates="replies")
    replies: Mapped[list["ReviewComment"]] = relationship(back_populates="parent", cascade="all")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    sender: Mapped["User"] = relationship(foreign_keys=[sender_id])
    recipient: Mapped["User"] = relationship(foreign_keys=[recipient_id])


class Notification(Base):
    __tablename__ = "notifications"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    review_id: Mapped[int | None] = mapped_column(ForeignKey("reviews.id", ondelete="CASCADE"), nullable=True, index=True)
    comment_id: Mapped[int | None] = mapped_column(ForeignKey("review_comments.id", ondelete="CASCADE"), nullable=True, index=True)
    chat_message_id: Mapped[int | None] = mapped_column(ForeignKey("chat_messages.id", ondelete="CASCADE"), nullable=True, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    recipient: Mapped["User"] = relationship(foreign_keys=[recipient_id])
    review: Mapped["Review | None"] = relationship(foreign_keys=[review_id])
    comment: Mapped["ReviewComment | None"] = relationship(foreign_keys=[comment_id])
    chat_message: Mapped["ChatMessage | None"] = relationship(foreign_keys=[chat_message_id])


Index("ix_review_comments_review_created", ReviewComment.review_id, ReviewComment.created_at)
Index("ix_chat_messages_pair_created", ChatMessage.sender_id, ChatMessage.recipient_id, ChatMessage.created_at)
Index("ix_chat_messages_recipient_read_created", ChatMessage.recipient_id, ChatMessage.is_read, ChatMessage.created_at)
Index("ix_notifications_recipient_read_created", Notification.recipient_id, Notification.is_read, Notification.created_at)
