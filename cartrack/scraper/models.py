"""
SQLAlchemy 2.0 models matching the Prisma schema for CarTrack.
"""

import hashlib
import os
from datetime import datetime, timezone
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    create_engine,
    event,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./cartrack.db")

# Prisma uses "file:../cartrack.db" format — normalise for SQLAlchemy
if DATABASE_URL.startswith("file:"):
    db_path = DATABASE_URL[5:]
    DATABASE_URL = f"sqlite:///{db_path}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

# Enable WAL mode for better concurrent reads
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


class Base(DeclarativeBase):
    pass


class Listing(Base):
    __tablename__ = "Listing"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    make: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    trim: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    mileage: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fuelType: Mapped[Optional[str]] = mapped_column("fuelType", String, nullable=True)
    transmission: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    colour: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    engineSize: Mapped[Optional[str]] = mapped_column("engineSize", String, nullable=True)
    sellerType: Mapped[Optional[str]] = mapped_column("sellerType", String, nullable=True)
    location: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    distance: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    listingUrl: Mapped[str] = mapped_column("listingUrl", String, unique=True, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)
    imageUrls: Mapped[str] = mapped_column("imageUrls", String, default="[]", nullable=False)
    vin: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    fingerprint: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    firstSeen: Mapped[datetime] = mapped_column(
        "firstSeen",
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    lastSeen: Mapped[datetime] = mapped_column(
        "lastSeen",
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    isActive: Mapped[bool] = mapped_column("isActive", Boolean, default=True, nullable=False)

    priceHistory: Mapped[list["PriceHistory"]] = relationship(
        "PriceHistory", back_populates="listing", cascade="all, delete-orphan"
    )
    savedBy: Mapped[list["SavedCar"]] = relationship(
        "SavedCar", back_populates="listing", cascade="all, delete-orphan"
    )


class PriceHistory(Base):
    __tablename__ = "PriceHistory"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    listingId: Mapped[str] = mapped_column(
        "listingId", String, ForeignKey("Listing.id"), nullable=False
    )
    price: Mapped[int] = mapped_column(Integer, nullable=False)
    recordedAt: Mapped[datetime] = mapped_column(
        "recordedAt",
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    listing: Mapped["Listing"] = relationship("Listing", back_populates="priceHistory")


class SavedSearch(Base):
    __tablename__ = "SavedSearch"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    filters: Mapped[str] = mapped_column(String, nullable=False)
    lastViewed: Mapped[datetime] = mapped_column(
        "lastViewed",
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    newCount: Mapped[int] = mapped_column("newCount", Integer, default=0, nullable=False)
    emailAlert: Mapped[bool] = mapped_column("emailAlert", Boolean, default=False, nullable=False)
    desktopAlert: Mapped[bool] = mapped_column(
        "desktopAlert", Boolean, default=True, nullable=False
    )
    createdAt: Mapped[datetime] = mapped_column(
        "createdAt",
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    alerts: Mapped[list["Alert"]] = relationship(
        "Alert", back_populates="savedSearch", cascade="all, delete-orphan"
    )


class SavedCar(Base):
    __tablename__ = "SavedCar"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    listingId: Mapped[str] = mapped_column(
        "listingId", String, ForeignKey("Listing.id"), nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    priceAtSave: Mapped[int] = mapped_column("priceAtSave", Integer, nullable=False)
    savedAt: Mapped[datetime] = mapped_column(
        "savedAt",
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    listing: Mapped["Listing"] = relationship("Listing", back_populates="savedBy")


class Alert(Base):
    __tablename__ = "Alert"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    savedSearchId: Mapped[str] = mapped_column(
        "savedSearchId", String, ForeignKey("SavedSearch.id"), nullable=False
    )
    listingId: Mapped[str] = mapped_column("listingId", String, nullable=False)
    sentAt: Mapped[datetime] = mapped_column(
        "sentAt",
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    type: Mapped[str] = mapped_column(String, nullable=False)

    savedSearch: Mapped["SavedSearch"] = relationship("SavedSearch", back_populates="alerts")


class Settings(Base):
    __tablename__ = "Settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    postcode: Mapped[str] = mapped_column(String, default="BS7 8NE", nullable=False)
    scrapeIntervalMinutes: Mapped[int] = mapped_column(
        "scrapeIntervalMinutes", Integer, default=30, nullable=False
    )
    maxResultsPerSource: Mapped[int] = mapped_column(
        "maxResultsPerSource", Integer, default=50, nullable=False
    )
    autotraderEnabled: Mapped[bool] = mapped_column(
        "autotraderEnabled", Boolean, default=True, nullable=False
    )
    motorsEnabled: Mapped[bool] = mapped_column(
        "motorsEnabled", Boolean, default=True, nullable=False
    )
    gumtreeEnabled: Mapped[bool] = mapped_column(
        "gumtreeEnabled", Boolean, default=True, nullable=False
    )
    ebayEnabled: Mapped[bool] = mapped_column(
        "ebayEnabled", Boolean, default=True, nullable=False
    )
    emailEnabled: Mapped[bool] = mapped_column(
        "emailEnabled", Boolean, default=False, nullable=False
    )
    smtpHost: Mapped[Optional[str]] = mapped_column("smtpHost", String, nullable=True)
    smtpPort: Mapped[Optional[int]] = mapped_column("smtpPort", Integer, nullable=True)
    smtpUser: Mapped[Optional[str]] = mapped_column("smtpUser", String, nullable=True)
    smtpPass: Mapped[Optional[str]] = mapped_column("smtpPass", String, nullable=True)
    alertEmail: Mapped[Optional[str]] = mapped_column("alertEmail", String, nullable=True)


def get_db():
    """FastAPI dependency that yields a database session."""
    from sqlalchemy.orm import sessionmaker

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all tables if they don't exist."""
    Base.metadata.create_all(bind=engine)


def compute_fingerprint(title: str, year: int, mileage: Optional[int], price: int) -> str:
    """
    Compute a stable fingerprint for a listing based on key fields.
    Used to detect duplicate/updated listings across scrapes.
    """
    raw = f"{title.lower().strip()}|{year}|{mileage or 0}|{price}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()
