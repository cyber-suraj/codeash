# CodeAsh — Hackathon Submission

**Event:** Hacktoberfest 2026 Hack Day — NIAT-ADYPU

**Initiative:** NIAT × Hacktoberfest 2026

**Participant:** Suraj Balasaheb Khanase (solo)

**Project:** CodeAsh

**Tagline:** Private, local security audit before you launch.

**Repository:** <https://github.com/cyber-suraj/codeash>

**Live cloud preview:** <https://codeash.vercel.app>

**Live API health:** <https://codeash-backend.onrender.com/health>

**Tracks:** Best Open-Source AI Project · Best Use of Gemma

---

## Short description

CodeAsh turns a natural-language-free security review into a deterministic
proof. Paste Python; Python's AST engine finds CWE-78, CWE-502, and CWE-798;
local Gemma 2 (`gemma2:9b`) through Ollama proposes a patch; and a Python
"kill switch" rejects anything that fails `ast.parse()` or still trips the
detector on a second scan. Local mode sends no code to a cloud model. The
hosted preview is labelled **CLOUD PREVIEW**, sends snippets only to the CodeAsh
Render backend, and uses the same verifier-approved deterministic fallback.

## Submission form description

### The zero-trust crisis in cloud AI security

Every day, engineering teams face an impossible security paradox: to audit code
or patch vulnerabilities rapidly, developers paste proprietary source code,
internal business logic, and AWS credentials into cloud-hosted LLMs. Doing so
creates a catastrophic intellectual-property and compliance leak. Worse,
standard AI code scanners rely on probabilistic hallucinations — asking an LLM
whether code is "safe" and blindly trusting its suggested patch without
deterministic proof.

**CodeAsh** ("burning away vulnerabilities to leave clean code") solves both
problems at the root by executing a local-first security pipeline powered by
open-weight **Gemma 2 (`gemma2:9b`)** via **Ollama** and Python's native
**Abstract Syntax Tree (`ast`)** engine.

### Core philosophy: "LLM proposes, Python disposes"

CodeAsh never trusts the AI's word. When source code enters the pipeline, the
deterministic Python AST and regex engine (`scanner.py`) walks the syntax tree
at the node level to pinpoint high-severity vulnerabilities — including
**CWE-78 (OS Command Injection)**, **CWE-502 (Unsafe Deserialization)**, and
**CWE-798 (Hardcoded Cryptographic Secrets)** — with zero cloud telemetry.

For each detected flaw, CodeAsh dispatches the isolated AST node to a locally
running **Gemma 2 (`gemma2:9b`)** instance via Ollama (`llm.py`) to synthesize a
drop-in security patch. Before that patch earns a green badge in the UI, it must
survive **The Kill Switch (`verify.py`)**: Python compiles the AI's patched code
back into a fresh Abstract Syntax Tree to prove syntactic validity
(`ast.parse`) and re-runs the full vulnerability scanner against the mutated
tree. Only when Python mathematically proves the CWE vector is eradicated does
CodeAsh mark the patch **VERIFIED**.

A deterministic fallback keeps the pipeline honest and crash-free when Ollama
or the 5.4 GB Gemma model is unavailable. Fallback patches are clearly labelled
and must pass the exact same verification gates.

### Why it matters

- **Privacy:** local mode has no cloud egress, API keys, telemetry, or CDN
  dependencies.
- **Trust:** the model cannot mark its own homework; `verify.py` is the final
  authority.
- **Transparency:** every finding shows the CWE, line, original snippet,
  candidate patch, provider, and verification result.
- **Demo resilience:** a cloud preview without a GPU still returns verified
  fallback patches instead of crashing.

---

## Technologies

- Next.js 15.5.28, React 19.1.0, Tailwind CSS 4
- FastAPI 0.115.6, Uvicorn 0.34.0, Pydantic 2.10.4, Python 3.12
- Ollama 0.4.5, Gemma 2 9B (`gemma2:9b`)
- Python `ast`, `re`, `textwrap`
- `react-diff-viewer-continued`, `lucide-react`, `geist`
- `unittest` (17 backend tests)

## AI tools

- Ollama + Gemma 2 (`gemma2:9b`) as the local patch-synthesis engine
- OpenCode for AI-assisted implementation, reviewed and verified by the
  participant

## Team and contributions

**Team name:** Solo — Suraj Balasaheb Khanase

**Team size:** 1 participant

**Participant and contribution:** Suraj Balasaheb Khanase — project concept,
security requirements, environment setup, local Gemma 2 verification, cloud
deployment, live-run verification, and submission preparation. Implementation
and documentation were produced with disclosed AI assistance under participant
direction.

## Demo evidence

- Screenshots: [`docs/screenshots/`](docs/screenshots/)
- Provenance: [`docs/screenshots/README.md`](docs/screenshots/README.md)
- Local browser run: [`browser-run.json`](docs/screenshots/browser-run.json) —
  production build, Gemma 2, **42.6 s**, **3/3 verified**, 0 rejected, 0
  console/page errors, 0 external requests
- Deployed browser run:
  [`live-browser-run.json`](docs/screenshots/live-browser-run.json) — Vercel +
  Render, **1.0 s**, **3/3 verified**, 0 rejected, fallback providers, only the
  Vercel app host and Render API host contacted, 0 unexpected requests, 0
  console/page errors
- Backend tests: `cd backend && .\venv\Scripts\python.exe -m unittest discover -v`
- Frontend checks: `cd frontend && npm run lint && npx tsc --noEmit && npm run build`

## Deployment

Live and verified on **2026-10-26**:

| Component | URL |
| --- | --- |
| Frontend | <https://codeash.vercel.app> |
| Backend | <https://codeash-backend.onrender.com> |
| Health | <https://codeash-backend.onrender.com/health> |
| API docs | <https://codeash-backend.onrender.com/docs> |

- **Frontend:** Vercel production, built with
  `NEXT_PUBLIC_API_URL=https://codeash-backend.onrender.com` in Production,
  Preview, and Development.
- **Backend:** Render free web service in Oregon, Python 3.11.9, defined by
  [`render.yaml`](render.yaml); health check at `/health`.
- **Cloud mode:** Render has no Ollama runtime, so hosted scans use the
  verifier-approved deterministic fallback. The UI labels this with
  `CLOUD PREVIEW`, `RENDER PREVIEW`, and `AST + FALLBACK`.
- **CORS:** a preflight request from `https://codeash.vercel.app` returns `200`
  with the matching allow-origin header.
- **Cold start:** Render's free instance may spin down after idle traffic; the
  first request can take up to a minute. The project remains fully runnable
  locally with Gemma 2.

## Originality and pre-existing work

- CodeAsh was created for this submission in a new public repository:
  <https://github.com/cyber-suraj/codeash>.
- The participant's earlier Workshop Planning Agent repository is a separate
  project and is not included in this submission.
- The implementation and documentation were produced with disclosed AI
  assistance; the disclosure is repeated in the Responsible AI statement and
  README §11.
- No undisclosed third-party project template or copied source code was added.
  Third-party dependencies remain under their upstream licenses.
- The sample credential is the public AWS documentation example
  `AKIAIOSFODNN7EXAMPLE`, not a real secret.

## Security and privacy

- Submitted Python is parsed, never imported, evaluated, or executed.
- Candidate patches are parsed and re-scanned, never executed.
- The API does not write submitted source to disk; logs are limited to CWE,
  line, provider, and verification status.
- Requests are bounded to 1–100,000 characters and validated by Pydantic.
- CORS is an explicit localhost/Vercel allowlist, not a credentialed wildcard.
- Local mode performs no network egress beyond the loopback backend.
- The hosted preview sends snippets only to the CodeAsh Render backend and
  discloses that flow in the UI. Render has no Ollama runtime and uses the
  labelled deterministic fallback.

## Requirements and compliance

The event compliance matrix, software and functional requirements, and
repository structure are documented in [REQUIREMENTS.md](REQUIREMENTS.md). The
judge-facing demo script is in [DEMO.md](DEMO.md), and conduct expectations are
in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Submission checklist

- [x] Public source repository
- [x] MIT license and author attribution
- [x] Complete README with architecture, setup, and limitations
- [x] Local Gemma 2 integration verified end to end
- [x] Deterministic fallback verified without Ollama
- [x] 17 backend tests pass
- [x] TypeScript, ESLint, and production build pass
- [x] Local browser evidence captured with Gemma 2
- [x] Frontend and backend deployed to Vercel and Render
- [x] Deployed browser run passes with 3/3 verified fallback patches
- [x] Responsible-AI and originality disclosure
- [x] Team size and contribution documented
- [x] Security and privacy review
- [x] Requirements and compliance matrix
- [x] Demo guide and Code of Conduct
- [ ] Confirm the solo entry complies with the announced team-size limit
- [ ] Final organizer registration and form submission
- [ ] Participant code review and final eligibility confirmation
- [ ] Submission completed before the announced deadline

## Responsible AI statement

CodeAsh is a security demonstration, not an autonomous patch-deployment tool.
A **VERIFIED** badge means the patch parses and the target CWE is no longer
detected; it does not prove full semantic equivalence or business-logic
correctness. A human must review every patch. The model output is treated as
untrusted input, user code is never executed, and the local pipeline stores no
submitted source.

The `AKIAIOSFODNN7EXAMPLE` string in the sample is the public AWS documentation
example, not a live credential.

## License

MIT License. Copyright (c) 2026 Suraj Balasaheb Khanase.
