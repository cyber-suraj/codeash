import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

VULNERABLE = (
    'import subprocess\n'
    'subprocess.run(f"echo {user_input}", shell=True)\n'
    'AWS_SECRET = "AKIAIOSFODNN7EXAMPLE"\n'
)


class ApiTests(unittest.TestCase):
    @patch("main.check_ollama_status", return_value=(False, False))
    def test_health_reports_fallback(self, _mock_status):
        response = client.get("/health")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["ok"] if "ok" in body else body["status"] == "ok")
        self.assertFalse(body["ollama_connected"])
        self.assertFalse(body["model_pulled"])

    def test_root_metadata(self):
        response = client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "CodeAsh")

    @patch("main.check_ollama_status", return_value=(False, False))
    def test_scan_uses_verified_fallback_patches(self, _mock_status):
        response = client.post("/scan", json={"code": VULNERABLE})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["total_vulnerabilities"], 2)
        self.assertEqual(body["verified_fixes"], 2)
        self.assertEqual(body["model"], "mock-fallback")
        self.assertTrue(all(f["verified"] for f in body["findings"]))
        self.assertTrue(all(f["provider"] == "mock" for f in body["findings"]))

    def test_empty_code_is_rejected(self):
        response = client.post("/scan", json={"code": ""})
        self.assertEqual(response.status_code, 422)

    def test_oversized_code_is_rejected(self):
        response = client.post("/scan", json={"code": "x" * 100_001})
        self.assertEqual(response.status_code, 422)

    def test_malformed_json_is_rejected(self):
        response = client.post(
            "/scan",
            content="{not-json",
            headers={"Content-Type": "application/json"},
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
