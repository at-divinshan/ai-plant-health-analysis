"""Offline contract tests: Gemini is mocked; no API key or network is used."""
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from pydantic import ValidationError

import ai_service
from main import app
from schemas import AnalysisResponse, PlantRequest


RECOMMENDATIONS = {
    "ideal_temperature": "Approximately 18–26 °C; avoid sudden temperature changes.",
    "sunlight_requirements": "Approximately 6–8 hours daily; introduce direct light gradually.",
    "watering_frequency": "Approximately every 3–5 days; check soil moisture first.",
    "humidity_level": "Approximately 50–70% relative humidity; maintain airflow.",
}
# Illustrative fixtures only, not verified horticultural recommendations.
RESPONSE = {
    "expert_advice_needed": False,
    "possible_issue": "Possible watering stress",
    "explanation": "Yellowing may have several causes.",
    "care_suggestions": ["Check soil moisture", "Check drainage", "Observe leaf changes"],
    "expert_advice": "Ask a local agricultural expert if symptoms spread.",
    **RECOMMENDATIONS,
}
REQUEST = {"plant_name": "Tomato", "plant_type": "Vegetable", "symptom": "Yellow leaves"}


class CareRecommendationTests(unittest.TestCase):
    def test_prompt_preserves_context_and_requests_every_field(self):
        for location in (None, "Balcony, Colombo"):
            with self.subTest(location=location):
                prompt = ai_service._build_prompt(PlantRequest(**REQUEST, location=location))
                data = json.loads(prompt.split("<plant_data>\n")[1].split("\n</plant_data>")[0])
                self.assertEqual(data["plant_name"], "Tomato")
                self.assertEqual(data["plant_type"], "Vegetable")
                self.assertEqual(data["symptoms"], "Yellow leaves")
                self.assertEqual(data["location"], location or "Not provided")
                for field in RECOMMENDATIONS:
                    self.assertIn(field, prompt)
                self.assertIn("otherwise give general", prompt)
                self.assertIn("approximate", prompt.lower())

    def test_json_and_fenced_json_preserve_all_results(self):
        for text in (json.dumps(RESPONSE), "```json\n" + json.dumps(RESPONSE) + "\n```"):
            self.assertEqual(ai_service._parse_response(text).model_dump(), RESPONSE)

    def test_new_fields_are_required_nonblank_strings(self):
        for field in RECOMMENDATIONS:
            for value in (None, "", "   ", 42, ["not a string"]):
                with self.subTest(field=field, value=value):
                    with self.assertRaises(ValidationError):
                        AnalysisResponse(**{**RESPONSE, field: value})
            missing = dict(RESPONSE)
            missing.pop(field)
            with self.assertRaises(ValidationError):
                AnalysisResponse(**missing)

    def test_recommendation_whitespace_is_trimmed(self):
        result = AnalysisResponse(**{**RESPONSE, "humidity_level": "  Approximately 50–70%  "})
        self.assertEqual(result.humidity_level, "Approximately 50–70%")

    def test_existing_request_validation_and_optional_location(self):
        self.assertIsNone(PlantRequest(**REQUEST, location="  ").location)
        for field, value in (("plant_name", " "), ("plant_name", "a" * 101),
                             ("plant_type", "Invalid"), ("symptom", ""),
                             ("symptom", "a" * 1001), ("location", "a" * 101)):
            with self.subTest(field=field), self.assertRaises(ValidationError):
                PlantRequest(**{**REQUEST, field: value})

    @patch.dict("os.environ", {"GEMINI_API_KEY": "test-only-key", "GEMINI_MODEL": "test-only-model"})
    @patch("ai_service.genai.Client")
    def test_endpoint_returns_all_fields_with_mocked_gemini(self, client_factory):
        generate = client_factory.return_value.models.generate_content
        generate.side_effect = [SimpleNamespace(text=json.dumps(value)) for value in ({"valid": True, "reason": "ok"}, RESPONSE) * 2]
        with TestClient(app) as client:
            for location in (None, "Balcony, Colombo"):
                response = client.post("/analyze", data={**REQUEST, "location": location or ""})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json(), RESPONSE)
            self.assertEqual(client.get("/health").json(), {"status": "ok"})
        args = generate.call_args.kwargs
        self.assertEqual(args["model"], "test-only-model")
        self.assertEqual(args["config"].temperature, 0.3)
        self.assertEqual(args["config"].response_mime_type, "application/json")

    @patch.dict("os.environ", {"GEMINI_API_KEY": "test-only-key"})
    @patch("ai_service.genai.Client")
    def test_bad_ai_outputs_keep_existing_error_response(self, client_factory):
        incomplete = dict(RESPONSE)
        incomplete.pop("humidity_level")
        with TestClient(app) as client:
            for text in ("not json", json.dumps(incomplete), ""):
                client_factory.return_value.models.generate_content.side_effect = [SimpleNamespace(text=json.dumps({"valid": True, "reason": "ok"})), SimpleNamespace(text=text)]
                response = client.post("/analyze", data=REQUEST)
                self.assertEqual(response.status_code, 502)
                self.assertIn("Please try again", response.json()["detail"])

    @patch("main.analyze_plant")
    def test_validation_and_service_errors_keep_existing_contract(self, analyze):
        with TestClient(app) as client:
            response = client.post("/analyze", data={**REQUEST, "symptom": " "})
            self.assertEqual(response.status_code, 422)
            self.assertIn("Invalid Plant Information", response.json()["detail"])
            analyze.assert_not_called()
            analyze.side_effect = ai_service.AIServiceError("Try again later.", 429)
            response = client.post("/analyze", data=REQUEST)
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response.json(), {"detail": "Try again later."})


if __name__ == "__main__":
    unittest.main()
