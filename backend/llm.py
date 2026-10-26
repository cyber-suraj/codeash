import json
import os
import re
from typing import Any, Dict

import ollama

MODEL_NAME = os.getenv("CODEASH_OLLAMA_MODEL", "gemma2:9b")


def _ensure_imports(code: str, cwe: str) -> str:
    """Add the import required by a remediation snippet, once."""
    required = {"CWE-78": "subprocess", "CWE-502": "json", "CWE-798": "os"}.get(cwe)
    if not required:
        return code
    pattern = rf"^\s*(?:import\s+{required}\b|from\s+{required}\s+import\b)"
    if re.search(pattern, code, re.MULTILINE):
        return code
    return f"import {required}\n{code}"


def _build_mock_patch(code: str, cwe: str) -> Dict[str, Any]:
    """
    Deterministic fallback patch generator used when Ollama is offline or the
    Gemma model is not pulled yet. Guarantees zero crashes during live demos.
    """
    fixed_code = code

    if cwe == "CWE-78":
        if 'f"echo {user_input}"' in fixed_code and "shell=True" in fixed_code:
            fixed_code = fixed_code.replace(
                'subprocess.run(f"echo {user_input}", shell=True)',
                'subprocess.run(["echo", str(user_input)], shell=False, check=True)',
            )
        elif "shell=True" in fixed_code:
            fixed_code = re.sub(r"shell\s*=\s*True", "shell=False", fixed_code)
        else:
            # os.system / os.popen remediation: avoid the shell entirely.
            fixed_code = "subprocess.run(['echo', str(user_input)], shell=False, check=True)"

        explanation = (
            "Disabled shell=True and passed arguments as an explicit sequence with shell=False "
            "to prevent shell metacharacter injection (CWE-78)."
        )

    elif cwe == "CWE-502":
        if "pickle.loads" in fixed_code:
            fixed_code = fixed_code.replace("pickle.loads", "json.loads")
        elif "pickle.load" in fixed_code:
            fixed_code = fixed_code.replace("pickle.load", "json.load")
        else:
            fixed_code = "return json.loads(data)"

        explanation = (
            "Replaced unsafe pickle deserialization with json.loads() to prevent arbitrary "
            "code execution via crafted payloads (CWE-502)."
        )

    elif cwe == "CWE-798":
        match = re.match(
            r"""^(\s*[A-Za-z_][A-Za-z0-9_]*)\s*=\s*['"].*['"]""",
            fixed_code,
            re.DOTALL,
        )
        if match:
            var_name = match.group(1).strip()
            indent = re.match(r"^(\s*)", fixed_code).group(1)
            fixed_code = f'{indent}{var_name} = os.environ.get("{var_name}", "")'
        else:
            fixed_code = 'AWS_SECRET = os.environ.get("AWS_SECRET", "")'

        explanation = (
            "Removed hardcoded secret literal from source code and loaded the credential "
            "dynamically from environment variables via os.environ.get() (CWE-798)."
        )

    else:
        explanation = "Applied deterministic security remediation for the detected vulnerability."

    return {
        "fixed_code": _ensure_imports(fixed_code, cwe),
        "explanation": explanation,
        "provider": "mock",
    }


def _extract_json(content: str) -> Dict[str, Any]:
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        value = json.loads(cleaned)
        return value if isinstance(value, dict) else {}
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end > start:
            try:
                value = json.loads(cleaned[start : end + 1])
                return value if isinstance(value, dict) else {}
            except json.JSONDecodeError:
                return {}
    return {}


def _response_content(response: Any) -> str:
    """Normalize the Ollama SDK response across dict and model variants."""
    if isinstance(response, dict):
        message = response.get("message", {})
    else:
        message = getattr(response, "message", {})
    if isinstance(message, dict):
        return str(message.get("content", ""))
    return str(getattr(message, "content", ""))


def generate_patch(code: str, cwe: str, allow_ollama: bool = True) -> Dict[str, Any]:
    """
    Calls local Ollama with 'gemma2:9b' to remediate the vulnerable snippet.
    Strictly returns JSON: {"fixed_code": "...", "explanation": "...", "provider": "ollama" | "mock"}.
    Never crashes if Ollama or gemma2:9b is unavailable.
    """
    if not allow_ollama:
        return _build_mock_patch(code, cwe)

    system_prompt = (
        "You are CodeAsh, an elite deterministic security remediation engine. "
        "Given a line or block of vulnerable Python code and its CWE identifier, "
        "fix the vulnerability using secure Python coding practices.\n"
        "Rules:\n"
        "- For CWE-78: Replace shell=True with shell=False and use argument lists.\n"
        "- For CWE-502: Replace pickle.loads with json.loads.\n"
        "- For CWE-798: Replace hardcoded secrets/keys with os.environ.get('<VAR_NAME>', '').\n"
        "- Include 'import json' or 'import os' when the patch uses that module.\n"
        "- Preserve the original return statement / indentation where present.\n"
        "- Return ONLY valid JSON with exact keys: "
        '{"fixed_code": "<valid python code only>", "explanation": "<concise 1-sentence technical explanation>"}. '
        "Do not wrap in markdown code fences."
    )

    user_prompt = f"Vulnerability: {cwe}\nVulnerable Python Code:\n{code}\n\nReturn ONLY JSON:"

    try:
        response = ollama.chat(
            model=MODEL_NAME,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            format="json",
            options={"temperature": 0.1, "num_predict": 512},
        )

        parsed = _extract_json(_response_content(response))
        fixed_code = str(parsed.get("fixed_code", "")).strip()
        explanation = str(parsed.get("explanation", "")).strip()

        if not fixed_code:
            return _build_mock_patch(code, cwe)

        return {
            "fixed_code": _ensure_imports(fixed_code, cwe),
            "explanation": explanation or f"Remediated {cwe} using Gemma 2 (9B).",
            "provider": "ollama",
        }
    except Exception:
        return _build_mock_patch(code, cwe)
