import unittest

from llm import _build_mock_patch
from scanner import scan_code
from verify import verify_patch

VULNERABLE_CODE = '''
import subprocess
import pickle

def run_cmd(user_input):
    subprocess.run(f"echo {user_input}", shell=True)

def load_data(data):
    return pickle.loads(data)

AWS_SECRET = "AKIAIOSFODNN7EXAMPLE"
'''


class ScannerTests(unittest.TestCase):
    def test_detects_three_cwes(self):
        findings = scan_code(VULNERABLE_CODE)
        self.assertEqual([f["cwe"] for f in findings], ["CWE-78", "CWE-502", "CWE-798"])
        self.assertEqual([f["line"] for f in findings], [6, 9, 11])

    def test_clean_code_has_no_findings(self):
        self.assertEqual(scan_code("def add(a, b):\n    return a + b\n"), [])

    def test_syntax_error_returns_empty_list(self):
        self.assertEqual(scan_code("def broken(:\n    pass"), [])

    def test_detects_os_system(self):
        findings = scan_code('import os\nos.system("ls " + user_input)\n')
        self.assertEqual(findings[0]["cwe"], "CWE-78")

    def test_detects_annotated_secret(self):
        findings = scan_code('api_key: str = "super-secret-value"\n')
        self.assertEqual(findings[0]["cwe"], "CWE-798")


class FallbackAndVerifierTests(unittest.TestCase):
    def test_every_fallback_patch_verifies(self):
        findings = scan_code(VULNERABLE_CODE)
        self.assertEqual(len(findings), 3)
        for finding in findings:
            patch = _build_mock_patch(finding["original_code"], finding["cwe"])
            self.assertNotEqual(patch["fixed_code"], finding["original_code"])
            self.assertTrue(
                verify_patch(
                    finding["original_code"],
                    patch["fixed_code"],
                    finding["cwe"],
                ),
                msg=f"{finding['cwe']} fallback failed verification",
            )

    def test_identical_patch_is_rejected(self):
        self.assertFalse(verify_patch("shell=True", "shell=True", "CWE-78"))

    def test_invalid_syntax_is_rejected(self):
        self.assertFalse(verify_patch("shell=True", "def broken(:", "CWE-78"))

    def test_indented_return_patch_is_accepted(self):
        self.assertTrue(
            verify_patch("return pickle.loads(data)", "return json.loads(data)", "CWE-502")
        )

    def test_still_vulnerable_patch_is_rejected(self):
        self.assertFalse(
            verify_patch(
                'subprocess.run(cmd, shell=True)',
                'subprocess.run(cmd, shell = True)',
                "CWE-78",
            )
        )


if __name__ == "__main__":
    unittest.main()
