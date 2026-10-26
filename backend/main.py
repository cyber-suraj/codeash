import logging
import os
from typing import List, Tuple

import ollama
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from llm import MODEL_NAME, _build_mock_patch, generate_patch
from scanner import scan_code
from verify import verify_patch

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("codeash")

# Render injects RENDER_GIT_COMMIT at build/runtime; local runs report "local".
REVISION = os.getenv("RENDER_GIT_COMMIT", "local")[:7]

app = FastAPI(
    title="CodeAsh Local Security Audit Engine",
    description=(
        "LLM proposes, Python disposes. Deterministic AST security scanner + "
        "local Gemma 2 patch verifier."
    ),
    version="1.0.0",
)

# Local development origins plus preview/production Vercel deployments. A
# wildcard is deliberately avoided so browser credentials can never be shared
# with arbitrary origins.
allowed_origins = [
    origin.strip()
    for origin in os.getenv(
        "CODEASH_ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://[A-Za-z0-9-]+\.vercel\.app",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class ScanRequest(BaseModel):
    code: str = Field(min_length=1, max_length=100_000)


class FindingResult(BaseModel):
    cwe: str
    message: str
    line: int
    original_code: str
    patched_code: str
    explanation: str
    verified: bool
    provider: str


class ScanResponse(BaseModel):
    findings: List[FindingResult]
    ollama_connected: bool
    model_pulled: bool
    model: str
    total_vulnerabilities: int
    verified_fixes: int


def check_ollama_status() -> Tuple[bool, bool]:
    """Return (server reachable, configured model installed)."""
    try:
        response = ollama.list()
        if isinstance(response, dict):
            models = response.get("models", [])
        else:
            models = getattr(response, "models", [])
        names = []
        for item in models:
            if isinstance(item, dict):
                name = item.get("model") or item.get("name") or ""
            else:
                name = getattr(item, "model", None) or getattr(item, "name", "")
            names.append(str(name))
        connected = True
        model_pulled = any(
            name == MODEL_NAME or name.startswith(f"{MODEL_NAME}:") for name in names
        )
        return connected, model_pulled
    except Exception:
        return False, False


@app.get("/")
def root():
    return {
        "name": "CodeAsh",
        "tagline": "Private, local security audit before you launch.",
        "docs": "/docs",
        "health": "/health",
        "revision": REVISION,
    }


@app.get("/health")
def health_check():
    connected, model_pulled = check_ollama_status()
    return {
        "status": "ok",
        "engine": "CodeAsh AST + Gemma 2 Verifier",
        "ollama_connected": connected,
        "model_pulled": model_pulled,
        "model": MODEL_NAME if model_pulled else "fallback-deterministic-mock",
        "revision": REVISION,
    }


@app.post("/scan", response_model=ScanResponse)
def scan_endpoint(payload: ScanRequest):
    raw_findings = scan_code(payload.code)
    enriched_findings: List[FindingResult] = []
    used_ollama = False

    ollama_connected, model_pulled = check_ollama_status()
    use_llm = ollama_connected and model_pulled

    if not use_llm:
        logger.info(
            "Ollama unavailable or %s not pulled; using deterministic fallback patches.",
            MODEL_NAME,
        )

    for item in raw_findings:
        cwe = item["cwe"]
        original_snippet = item["original_code"]

        if use_llm:
            patch_data = generate_patch(original_snippet, cwe, allow_ollama=True)
        else:
            patch_data = _build_mock_patch(original_snippet, cwe)

        patched_snippet = patch_data["fixed_code"]
        explanation = patch_data["explanation"]
        provider = patch_data.get("provider", "mock")

        if provider == "ollama":
            used_ollama = True

        is_verified = verify_patch(
            original_code=original_snippet,
            patched_code=patched_snippet,
            cwe=cwe,
        )
        logger.info(
            "%s line %s provider=%s verified=%s",
            cwe,
            item["line"],
            provider,
            is_verified,
        )

        enriched_findings.append(
            FindingResult(
                cwe=cwe,
                message=item["message"],
                line=item["line"],
                original_code=original_snippet,
                patched_code=patched_snippet,
                explanation=explanation,
                verified=is_verified,
                provider=provider,
            )
        )

    verified_count = sum(1 for finding in enriched_findings if finding.verified)

    return ScanResponse(
        findings=enriched_findings,
        ollama_connected=ollama_connected,
        model_pulled=model_pulled,
        model="gemma2:9b" if used_ollama else "mock-fallback",
        total_vulnerabilities=len(enriched_findings),
        verified_fixes=verified_count,
    )
