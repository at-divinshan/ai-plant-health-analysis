"""Opt-in MySQL integration tests. All fixture writes roll back; no DDL or seed data."""
import os
import unittest
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import IntegrityError
import hashlib
from sqlalchemy.orm import Session

from database import get_db, get_engine
from main import app
from models import AnalysisShare, Person, Plant, PlantAnalysis
from storage_api import save_lock


@unittest.skipUnless(os.getenv("RUN_MYSQL_TESTS") == "1", "Set RUN_MYSQL_TESTS=1 for rollback-only MySQL tests")
class MySQLStorageTests(unittest.TestCase):
    def setUp(self):
        self.connection = get_engine().connect()
        self.transaction = self.connection.begin()
        self.before = {model.__tablename__: self.connection.scalar(select(func.count()).select_from(model))
                       for model in (Plant, PlantAnalysis, Person, AnalysisShare)}
        def transaction_session():
            with Session(bind=self.connection, expire_on_commit=False, join_transaction_mode="create_savepoint") as session:
                yield session
        app.dependency_overrides[get_db] = transaction_session
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        self.transaction.rollback()
        for model in (Plant, PlantAnalysis, Person, AnalysisShare):
            self.assertEqual(self.connection.scalar(select(func.count()).select_from(model)), self.before[model.__tablename__])
        self.connection.close()
        self.client.close()

    def analysis_payload(self):
        return {"id": str(uuid4()), "analyzedAt": datetime.now(timezone.utc).isoformat(),
            "plant": {"plant_name": "Rollback test plant", "plant_type": "Other", "location": None, "symptom": "Integration test context"},
            "result": {"possible_issue": "Test issue", "explanation": "Test explanation", "care_suggestions": ["One", "Two", "Three"],
                       "expert_advice": "Test advice", "ideal_temperature": "Long guidance " * 15,
                       "sunlight_requirements": "Test sunlight", "watering_frequency": "Test watering", "humidity_level": "Long humidity guidance " * 10}}

    def add_person(self, name="Rollback test person", email=None):
        response = self.client.post("/people", json={"name": name, "email": email})
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def test_models_match_live_columns_without_ddl(self):
        inspector = inspect(self.connection)
        for model in (Plant, PlantAnalysis, Person, AnalysisShare):
            actual = inspector.get_columns(model.__tablename__)
            self.assertEqual({col["name"] for col in actual}, set(model.__table__.columns.keys()))
            for col in actual:
                mapped = model.__table__.c[col["name"]]
                self.assertEqual(getattr(mapped.type, "length", None), getattr(col["type"], "length", None))

    def test_save_view_retry_and_delete_complete_analysis(self):
        payload = self.analysis_payload()
        first = self.client.post("/analyses", json=payload)
        self.assertEqual(first.status_code, 200, first.text)
        entry = first.json()
        self.assertEqual(entry["result"], payload["result"])
        self.assertEqual(entry["plant"], payload["plant"])
        self.assertEqual(entry["analyzedAt"], payload["analyzedAt"])
        self.assertEqual(self.client.post("/analyses", json=payload).json()["id"], entry["id"])
        self.assertEqual(self.client.get(f"/analyses/{entry['id']}").json(), entry)
        self.assertIn(entry, self.client.get("/analyses").json())
        changed = {**payload, "plant": {**payload["plant"], "plant_name": "Different content"}}
        self.assertEqual(self.client.post("/analyses", json=changed).status_code, 409)
        self.assertEqual(self.client.delete(f"/analyses/{entry['id']}").status_code, 204)
        self.assertEqual(self.client.get(f"/analyses/{entry['id']}").status_code, 404)
        self.assertEqual(self.connection.scalar(select(func.count()).select_from(Plant)), self.before["plants"] + 1)

    def test_people_crud_search_and_validation(self):
        email = f"{uuid4().hex}@example.org"
        person = self.add_person(email=email)
        self.assertEqual(self.client.post("/people", json={"name": "Duplicate", "email": email}).status_code, 409)
        changed = self.client.put(f"/people/{person['id']}", json={"name": "Updated rollback person", "email": email})
        self.assertEqual(changed.status_code, 200, changed.text)
        self.assertTrue(any(row["id"] == person["id"] for row in self.client.get("/people", params={"q": email}).json()))
        self.assertEqual(self.client.post("/people", json={"name": " ", "email": "not-an-email"}).status_code, 422)
        self.assertEqual(self.client.delete(f"/people/{person['id']}").status_code, 204)
        self.assertFalse(any(row["id"] == person["id"] for row in self.client.get("/people").json()))

    def test_multiple_people_sharing_is_atomic_and_deduplicated(self):
        analysis_response = self.client.post("/analyses", json=self.analysis_payload())
        self.assertEqual(analysis_response.status_code, 200, analysis_response.text)
        analysis = analysis_response.json()
        first, second = self.add_person(), self.add_person("Second rollback person")
        path = f"/analyses/{analysis['id']}/shares"
        response = self.client.put(path, json={"person_ids": [first["id"], second["id"], first["id"]]})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(len(response.json()["shares"]), 2)
        self.assertIn("No email or message was sent", response.json()["message"])
        self.assertEqual(len(self.client.get(path).json()), 2)
        self.assertEqual(self.client.put(path, json={"person_ids": [first["id"], 2147483647]}).status_code, 422)
        self.assertEqual(len(self.client.get(path).json()), 2)
        self.client.delete(f"/people/{first['id']}")
        self.assertEqual(len(self.client.get(path).json()), 1)
        self.assertEqual(self.client.get(f"/analyses/{analysis['id']}").status_code, 200)
        self.assertEqual(self.client.put(path, json={"person_ids": []}).json()["shares"], [])

    def test_failed_write_releases_idempotency_lock(self):
        client_id = str(uuid4())
        lock_name = "plant-save:" + hashlib.sha256(client_id.encode()).hexdigest()[:48]
        with Session(bind=self.connection, join_transaction_mode="create_savepoint") as session:
            with self.assertRaises(IntegrityError):
                with save_lock(session, client_id):
                    session.add(Plant(name=None, plant_type="Other", symptoms="Rollback test"))
                    session.flush()
            self.assertIsNone(session.execute(text("SELECT IS_USED_LOCK(:name)"), {"name": lock_name}).scalar())

    def test_person_owned_plants_history_and_deletion(self):
        first, second = self.add_person(), self.add_person("Other owner")
        payload = self.analysis_payload()
        payload["person_id"] = first["id"]
        response = self.client.post("/analyses", json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        entry = response.json()
        self.assertEqual(entry["person_id"], first["id"])
        self.assertEqual(self.connection.scalar(select(Plant.person_id).where(Plant.id == entry["plant_id"])), first["id"])
        self.assertEqual(self.client.post("/analyses", json=payload).json()["id"], entry["id"])
        changed = {**payload, "person_id": second["id"]}
        self.assertEqual(self.client.post("/analyses", json=changed).status_code, 409)
        path = f"/people/{first['id']}/plants"
        history = self.client.get(path).json()
        self.assertEqual(history["person"]["id"], first["id"])
        self.assertEqual(history["plants"][0]["symptom"], payload["plant"]["symptom"])
        self.assertEqual(history["plants"][0]["analyses"], [entry])
        self.assertTrue(history["plants"][0]["savedAt"])
        self.assertEqual(self.client.get(f"/people/{second['id']}/plants").json()["plants"], [])
        # Sharing does not change plant ownership.
        self.client.put(f"/analyses/{entry['id']}/shares", json={"person_ids": [second["id"]]})
        self.assertEqual(self.client.get(f"/people/{second['id']}/plants").json()["plants"], [])
        self.assertEqual(self.client.delete(f"/people/{first['id']}").status_code, 204)
        remaining = self.client.get(f"/analyses/{entry['id']}").json()
        self.assertIsNone(remaining["person_id"])
        self.assertEqual(remaining["result"], payload["result"])
        self.assertEqual(self.client.get(path).status_code, 404)

    def test_missing_owner_unassigned_and_retained_plant(self):
        payload = self.analysis_payload()
        payload["person_id"] = 2147483647
        self.assertEqual(self.client.post("/analyses", json=payload).status_code, 422)
        payload["person_id"] = -1
        self.assertEqual(self.client.post("/analyses", json=payload).status_code, 422)
        payload.pop("person_id")
        entry = self.client.post("/analyses", json=payload).json()
        self.assertIsNone(entry["person_id"])
        person = self.add_person()
        payload = self.analysis_payload()
        payload["person_id"] = person["id"]
        entry = self.client.post("/analyses", json=payload).json()
        self.client.delete(f"/analyses/{entry['id']}")
        history = self.client.get(f"/people/{person['id']}/plants").json()
        self.assertEqual(len(history["plants"]), 1)
        self.assertEqual(history["plants"][0]["analyses"], [])

    def test_legacy_browser_records_without_recommendations(self):
        payload = self.analysis_payload()
        for field in ("ideal_temperature", "sunlight_requirements", "watering_frequency", "humidity_level"):
            payload["result"].pop(field)
        response = self.client.post("/analyses", json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertIsNone(response.json()["result"]["humidity_level"])
        self.assertEqual(self.client.post("/analyses", json=payload).json()["id"], response.json()["id"])


if __name__ == "__main__":
    unittest.main()
