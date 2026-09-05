from decimal import Decimal
from sqlalchemy.orm import Session
from .models import Hotel, User
from .auth import hash_password

HOTELS = [
    ("26 july apartments", Decimal("0.15")),
    ("Golden jewel ismailia", Decimal("0")),
    ("Aguoza hotel", Decimal("0")),
    ("Assiut Hotel", Decimal("0")),
    ("Dokki Hotel", Decimal("0")),
    ("Inn Elbakry Hotel", Decimal("0")),
    ("Inn BeniSuef Hotel", Decimal("0")),
    ("Maadi Cabins and Club", Decimal("0")),
    ("Mamoura Armed Forces", Decimal("0")),
    ("Royal Jewel El-Raml", Decimal("0")),
    ("Asafra Hotel apartments", Decimal("0")),
    ("Minya Compound of the Armed Forces", Decimal("0")),
    ("Plaza Hotel", Decimal("0")),
    ("Beach Matrouh Hotel", Decimal("0")),
    ("Port Said Hotel", Decimal("0")),
    ("Zamalek Hotel", Decimal("0")),
    ("Sharm El Sheikh Hotel", Decimal("0")),
    ("Green Mountain Hotel", Decimal("0")),
    ("Glorious Hotel", Decimal("0")),
    ("Al Nasr Hotel & Apartments", Decimal("0")),
    ("Fayed Hotel", Decimal("0")),
    ("Ras El Bar Apartments Armed Forces", Decimal("0")),
    ("Fayoum Hotel Armed Forces", Decimal("0")),
    ("Luxor Hotel", Decimal("0")),
    ("Matrouh Hotel", Decimal("0")),
    ("Mandara Apartments", Decimal("0")),
    ("El Gameel Hotel", Decimal("0")),
    ("El Obayed Apartments Armed Forces", Decimal("0")),
    ("Fanara Apartments Armed Forces", Decimal("0")),
    ("Ajami Hotel Armed Forces Apartments", Decimal("0")),
    ("Al-Giaal Club", Decimal("0")),
    ("Alfustat Hotel", Decimal("0")),
    ("plaza bana hotel", Decimal("0")),
    ("JEWEL INN MATROUH", Decimal("0")),
    ("Maamoura Armed Forces Apartments", Decimal("0")),
]

USERS = [
    ("Mostafa", "M123456m", "Mostafa", "admin"),
    ("Mohamed", "M1234m", "Mohamed", "employee"),
    ("Mang", "Mm123456", "Mang", "manager"),
]


def seed_defaults(db: Session):
    for username, password, display_name, role in USERS:
        if not db.query(User).filter_by(username=username).first():
            db.add(User(username=username, password_hash=hash_password(password), display_name=display_name, role=role, active=True))
    for name, rate in HOTELS:
        if not db.query(Hotel).filter_by(name=name).first():
            db.add(Hotel(name=name, commission_rate=rate, active=True))
    db.commit()
