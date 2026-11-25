"""Offline tests: no database or live Gemini requests."""
import io
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch
import httpx
from PIL import Image
from fastapi.testclient import TestClient
from google.genai import errors
import ai_service
from main import app, MAX_IMAGE_SIZE
from schemas import PlantRequest
from test_care_recommendations import REQUEST, RESPONSE


def reply(value):
    return SimpleNamespace(text=json.dumps(value))


@patch.dict('os.environ', {'GEMINI_API_KEY': 'test-only-key'})
class ImageValidationTests(unittest.TestCase):
    @patch('ai_service.genai.Client')
    def test_rejections_stop_before_diagnosis(self, factory):
        generate = factory.return_value.models.generate_content
        for reason in ('non_plant', 'blurry', 'unclear', 'plant_name_mismatch', 'identity_uncertain', 'symptom_conflict', 'multiple_plants'):
            generate.reset_mock()
            generate.side_effect = [reply({'valid': True, 'reason': 'ok'}), reply({'valid': False, 'reason': reason})]
            with self.subTest(reason=reason), self.assertRaises(ai_service.AIServiceError) as raised:
                ai_service.analyze_plant(PlantRequest(**REQUEST), b'photo', 'image/png')
            self.assertEqual(raised.exception.status_code, 422)
            self.assertEqual(generate.call_count, 2)

    @patch('ai_service.genai.Client')
    def test_healthy_diseased_and_out_of_frame_symptoms(self, factory):
        generate = factory.return_value.models.generate_content
        for symptom in ('Healthy green leaves', 'Yellow leaves', 'Roots rotting outside the photo'):
            generate.side_effect = [reply({'valid': True, 'reason': 'ok'}), reply({'valid': True, 'reason': 'ok'}), reply(RESPONSE)]
            result = ai_service.analyze_plant(PlantRequest(**{**REQUEST, 'symptom': symptom}), b'photo', 'image/png')
            self.assertEqual(result.model_dump(), RESPONSE)
            prompt = generate.call_args_list[-2].kwargs['contents'][0]
            self.assertIn('Tomato', prompt)
            self.assertIn(symptom, prompt)

    @patch('ai_service.genai.Client')
    def test_types_and_malformed_verdicts(self, factory):
        generate = factory.return_value.models.generate_content
        for verdict, status in (({'valid': False, 'reason': 'plant_type_mismatch'}, 422), ({'valid': 'true', 'reason': 'ok'}, 502), ({'valid': True}, 502), ({'valid': False, 'reason': 'ok'}, 502)):
            generate.side_effect = [reply(verdict)]
            with self.assertRaises(ai_service.AIServiceError) as raised:
                ai_service.analyze_plant(PlantRequest(**REQUEST))
            self.assertEqual(raised.exception.status_code, status)
        for category in ('Vegetable', 'Fruit', 'Indoor Plant', 'Other'):
            generate.side_effect = [reply({'valid': True, 'reason': 'ok'}), reply(RESPONSE)]
            self.assertEqual(ai_service.analyze_plant(PlantRequest(**{**REQUEST, 'plant_type': category})).model_dump(), RESPONSE)
        for verdict in ({'valid': True, 'reason': 'blurry'}, {'valid': False, 'reason': 'ok'}, {'valid': True}):
            generate.side_effect = [reply({'valid': True, 'reason': 'ok'}), reply(verdict)]
            with self.assertRaises(ai_service.AIServiceError) as raised:
                ai_service.analyze_plant(PlantRequest(**REQUEST), b'photo', 'image/png')
            self.assertEqual(raised.exception.status_code, 502)

    @patch('ai_service.genai.Client')
    def test_api_failures(self, factory):
        for failure, status in ((httpx.ReadTimeout('timeout'), 504), (errors.APIError(429, {'error': {'message': 'quota'}}), 429), (errors.APIError(503, {'error': {'message': 'unavailable'}}), 502)):
            factory.return_value.models.generate_content.side_effect = failure
            with self.assertRaises(ai_service.AIServiceError) as raised:
                ai_service.analyze_plant(PlantRequest(**REQUEST))
            self.assertEqual(raised.exception.status_code, status)

    @patch('main.analyze_plant')
    def test_image_files_and_text_only_endpoint(self, analyze):
        analyze.return_value = RESPONSE
        with TestClient(app) as client:
            self.assertEqual(client.post('/analyze', data=REQUEST).status_code, 200)
            self.assertIsNone(analyze.call_args.kwargs['image_bytes'])
            for fmt, mime in (('PNG', 'image/png'), ('JPEG', 'image/jpeg'), ('WEBP', 'image/webp')):
                output = io.BytesIO()
                Image.new('RGB', (16, 16), 'green').save(output, format=fmt)
                self.assertEqual(client.post('/analyze', data=REQUEST, files={'image': ('plant', output.getvalue(), mime)}).status_code, 200)
            for content, mime, status in ((b'broken', 'image/png', 400), (b'', 'image/png', 400), (b'x' * (MAX_IMAGE_SIZE + 1), 'image/png', 413), (b'not an image', 'text/plain', 400)):
                analyze.reset_mock()
                self.assertEqual(client.post('/analyze', data=REQUEST, files={'image': ('plant', content, mime)}).status_code, status)
                analyze.assert_not_called()
            with patch('main.Image.open', side_effect=Image.DecompressionBombError()):
                self.assertEqual(client.post('/analyze', data=REQUEST, files={'image': ('plant', b'compressed', 'image/png')}).status_code, 400)
