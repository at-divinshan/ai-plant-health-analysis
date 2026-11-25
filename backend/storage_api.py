"""Database CRUD and recorded sharing; no email or message delivery."""
import hashlib
from contextlib import contextmanager
from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, or_, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from database import get_db
from models import AnalysisShare, Person, Plant, PlantAnalysis
from storage_schemas import PersonRequest, SaveAnalysisRequest, ShareRequest

router = APIRouter()


def iso_date(value):
    return value.replace(tzinfo=timezone.utc).isoformat() if value else None


def person_data(person):
    return {"id": person.id, "name": person.name, "email": person.email,
            "created_at": iso_date(person.created_at)}


def analysis_data(analysis, plant):
    stored = analysis.care_suggestions
    metadata = stored.get("metadata", {}) if isinstance(stored, dict) else {}
    tips = stored.get("items", []) if isinstance(stored, dict) else stored
    result = {key: getattr(analysis, key) for key in (
        "possible_issue", "explanation", "expert_advice", "ideal_temperature",
        "sunlight_requirements", "watering_frequency", "humidity_level")}
    # Keep legacy JSON arrays readable, and preserve long/new AI fields losslessly.
    result.update(metadata.get("full_result", {}))
    result["care_suggestions"] = tips if isinstance(tips, list) else []
    return {"person_id": plant.person_id, "plant_id": plant.id, "id": str(analysis.id), "clientId": metadata.get("client_id"),
            "analyzedAt": metadata.get("analyzed_at") or iso_date(analysis.created_at),
            "plant": {"plant_name": plant.name, "plant_type": plant.plant_type,
                      "location": plant.location, "symptom": plant.symptoms}, "result": result}


def analysis_row(db, analysis_id, lock=False):
    stmt = select(PlantAnalysis, Plant).join(Plant, Plant.id == PlantAnalysis.plant_id).where(PlantAnalysis.id == analysis_id)
    if lock:
        stmt = stmt.with_for_update()
    row = db.execute(stmt).first()
    if row is None:
        raise HTTPException(404, "Analysis not found.")
    return row


@contextmanager
def save_lock(db, client_id):
    name = "plant-save:" + hashlib.sha256(client_id.encode()).hexdigest()[:48]
    if db.execute(text("SELECT GET_LOCK(:name, 10)"), {"name": name}).scalar() != 1:
        raise HTTPException(409, "This analysis is being saved. Please try again.")
    try:
        yield
    except Exception:
        # A failed flush must be rolled back before releasing its connection lock.
        db.rollback()
        raise
    finally:
        # Bound connection stays the same even after commit/rollback.
        db.execute(text("SELECT RELEASE_LOCK(:name)"), {"name": name})


@router.get("/analyses")
def list_analyses(db: Session = Depends(get_db)):
    rows = db.execute(select(PlantAnalysis, Plant).join(Plant).order_by(PlantAnalysis.created_at.desc(), PlantAnalysis.id.desc())).all()
    return [analysis_data(*row) for row in rows]


@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: int, db: Session = Depends(get_db)):
    return analysis_data(*analysis_row(db, analysis_id))


@router.post("/analyses")
def save_analysis(payload: SaveAnalysisRequest, db: Session = Depends(get_db)):
    with save_lock(db, payload.id):
        existing = db.scalar(select(PlantAnalysis).where(
            PlantAnalysis.care_suggestions["metadata"]["client_id"].as_string() == payload.id))
        if existing:
            data = analysis_data(existing, db.get(Plant, existing.plant_id))
            # A repeated ID with different content must never silently lose a record.
            if data["person_id"] != payload.person_id or data["plant"] != payload.plant.model_dump() or data["result"] != payload.result.model_dump() or data["analyzedAt"] != payload.analyzedAt.isoformat():
                raise HTTPException(409, "An analysis with this reference already exists with different content.")
            return data
        if payload.person_id is not None and db.scalar(select(Person).where(Person.id == payload.person_id).with_for_update()) is None:
            raise HTTPException(422, "The selected person no longer exists. Reload the people list.")
        plant = Plant(person_id=payload.person_id, name=payload.plant.plant_name, plant_type=payload.plant.plant_type,
                      location=payload.plant.location, symptoms=payload.plant.symptom)
        db.add(plant)
        db.flush()
        result = payload.result.model_dump()
        created = payload.analyzedAt.replace(tzinfo=None)
        analysis = PlantAnalysis(plant_id=plant.id, created_at=created,
            possible_issue=result["possible_issue"], explanation=result["explanation"],
            expert_advice=result["expert_advice"], sunlight_requirements=result["sunlight_requirements"],
            watering_frequency=result["watering_frequency"],
            ideal_temperature=result["ideal_temperature"] if len(result["ideal_temperature"] or "") <= 100 else None,
            humidity_level=result["humidity_level"] if len(result["humidity_level"] or "") <= 100 else None,
            care_suggestions={"items": result["care_suggestions"], "metadata": {
                "client_id": payload.id, "analyzed_at": payload.analyzedAt.isoformat(), "full_result": result}})
        db.add(analysis)
        db.flush()
        data = analysis_data(analysis, plant)
        db.commit()
        return data


@router.delete("/analyses/{analysis_id}", status_code=204)
def delete_analysis(analysis_id: int, db: Session = Depends(get_db)):
    analysis, _ = analysis_row(db, analysis_id, lock=True)
    db.execute(delete(AnalysisShare).where(AnalysisShare.analysis_id == analysis_id))
    db.delete(analysis)
    # A plant can be referenced by other analyses; never delete the plant implicitly.
    db.commit()
    return Response(status_code=204)


@router.get("/people")
def list_people(q: str = Query(default="", max_length=150), db: Session = Depends(get_db)):
    stmt = select(Person)
    if q.strip():
        stmt = stmt.where(or_(Person.name.contains(q.strip(), autoescape=True), Person.email.contains(q.strip(), autoescape=True)))
    return [person_data(person) for person in db.scalars(stmt.order_by(Person.name, Person.id))]


def commit_person(db):
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A person with this email already exists.") from None


@router.post("/people", status_code=201)
def add_person(payload: PersonRequest, db: Session = Depends(get_db)):
    person = Person(**payload.model_dump())
    db.add(person)
    commit_person(db)
    db.refresh(person)
    return person_data(person)


@router.put("/people/{person_id}")
def edit_person(person_id: int, payload: PersonRequest, db: Session = Depends(get_db)):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found.")
    person.name, person.email = payload.name, payload.email
    commit_person(db)
    return person_data(person)


@router.delete("/people/{person_id}", status_code=204)
def delete_person(person_id: int, db: Session = Depends(get_db)):
    person = db.get(Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found.")
    db.execute(delete(AnalysisShare).where(AnalysisShare.person_id == person_id))
    db.delete(person)
    db.commit()
    return Response(status_code=204)


@router.get("/analyses/{analysis_id}/shares")
def list_shares(analysis_id: int, db: Session = Depends(get_db)):
    analysis_row(db, analysis_id)
    rows = db.execute(select(AnalysisShare, Person).join(Person, Person.id == AnalysisShare.person_id)
                      .where(AnalysisShare.analysis_id == analysis_id).order_by(Person.name)).all()
    return [{"person": person_data(person), "shared_at": iso_date(share.shared_at)} for share, person in rows]


@router.put("/analyses/{analysis_id}/shares")
def update_shares(analysis_id: int, payload: ShareRequest, db: Session = Depends(get_db)):
    analysis_row(db, analysis_id, lock=True)
    ids = set(payload.person_ids)
    found = set(db.scalars(select(Person.id).where(Person.id.in_(ids)).with_for_update())) if ids else set()
    if found != ids:
        raise HTTPException(422, "One or more selected people no longer exist. Reload the people list.")
    existing = {share.person_id: share for share in db.scalars(select(AnalysisShare).where(AnalysisShare.analysis_id == analysis_id))}
    for person_id, share in existing.items():
        if person_id not in ids:
            db.delete(share)
    for person_id in ids - existing.keys():
        db.add(AnalysisShare(analysis_id=analysis_id, person_id=person_id))
    db.commit()
    return {"shares": list_shares(analysis_id, db), "message": "Sharing assignments saved. No email or message was sent."}


@router.get("/people/{person_id}/plants")
def person_plants(person_id: int, db: Session = Depends(get_db)):
    person = db.get(Person, person_id)
    if person is None:
        raise HTTPException(404, "Person not found.")
    rows = db.execute(select(Plant, PlantAnalysis).outerjoin(PlantAnalysis, PlantAnalysis.plant_id == Plant.id)
        .where(Plant.person_id == person_id).order_by(Plant.created_at.desc(), Plant.id.desc(), PlantAnalysis.created_at.desc(), PlantAnalysis.id.desc())).all()
    plants = {}
    for plant, analysis in rows:
        if plant.id not in plants:
            plants[plant.id] = {"id": plant.id, "plant_name": plant.name, "plant_type": plant.plant_type,
                "location": plant.location, "symptom": plant.symptoms, "savedAt": iso_date(plant.created_at), "analyses": []}
        if analysis is not None:
            plants[plant.id]["analyses"].append(analysis_data(analysis, plant))
    return {"person": person_data(person), "plants": list(plants.values())}
