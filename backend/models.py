"""Mappings of the inspected existing plant_health_db tables. No DDL is executed."""
from sqlalchemy import Column, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.mysql import JSON, TIMESTAMP
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class Plant(Base):
    __tablename__ = "plants"
    id = Column(Integer, primary_key=True, autoincrement=True)
    person_id = Column(Integer, ForeignKey("people.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(150), nullable=False)
    plant_type = Column(String(100), nullable=False)
    location = Column(String(255))
    symptoms = Column(Text, nullable=False)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))


class PlantAnalysis(Base):
    __tablename__ = "plant_analyses"
    id = Column(Integer, primary_key=True, autoincrement=True)
    plant_id = Column(Integer, ForeignKey("plants.id", ondelete="CASCADE"), nullable=False, index=True)
    possible_issue = Column(Text)
    explanation = Column(Text)
    care_suggestions = Column(JSON)
    expert_advice = Column(Text)
    ideal_temperature = Column(String(100))
    sunlight_requirements = Column(Text)
    watering_frequency = Column(Text)
    humidity_level = Column(String(100))
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))


class Person(Base):
    __tablename__ = "people"
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(150), nullable=False)
    email = Column(String(255), unique=True)
    created_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))


class AnalysisShare(Base):
    __tablename__ = "analysis_shares"
    __table_args__ = (UniqueConstraint("analysis_id", "person_id"),)
    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(Integer, ForeignKey("plant_analyses.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(Integer, ForeignKey("people.id", ondelete="CASCADE"), nullable=False, index=True)
    shared_at = Column(TIMESTAMP, server_default=text("CURRENT_TIMESTAMP"))
