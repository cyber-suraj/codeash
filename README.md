# CODEASH // DETERMINISTIC LOCAL AI SECURITY AUDITOR

> **"LLM proposes, Python disposes."**
>
> *Private, local security audit before you launch.*

**Built for Hacktoberfest 2026 Hack Day (NIAT-ADYPU)** — targeting **Best
Open-Source AI Project** and **Best Use of Gemma**.

**Author:** Suraj Balasaheb Khanase

**Repository:** <https://github.com/cyber-suraj/codeash>

**Live cloud preview:** <https://codeash.vercel.app> — explicitly labelled
fallback mode. For the full zero-egress Gemma 2 experience, run CodeAsh locally
(see [Quickstart](#7-quickstart)).

**Live API health:** <https://codeash-backend.onrender.com/health>

**Demo guide:** [`DEMO.md`](DEMO.md) · **Requirements and compliance:**
[`REQUIREMENTS.md`](REQUIREMENTS.md)

---

## 1. The zero-trust AI security manifesto

Modern software teams are trapped in a dangerous anti-pattern: pasting
proprietary source code, internal architecture, and hardcoded credentials into
cloud-hosted LLMs to fix security bugs. Cloud AI code scanners are an inherent
data leak, and worse, they operate on probabilistic guesswork — asking an LLM
whether its own generated patch is "safe."

**CodeAsh** burns away vulnerabilities on the local machine with zero cloud
egress and zero blind trust in AI outputs. The language model is useful for
synthesizing a patch, but it is never the authority on whether that patch is
correct. Python's Abstract Syntax Tree engine is.

The project follows one rule:

> **The LLM proposes. Python disposes. A patch earns a green badge only after
> `ast.parse()` succeeds and a full deterministic re-scan proves the CWE is
> gone.**

---

## 2. What CodeAsh detects

| CWE | Vulnerability | Deterministic detector | Default remediation |
| --- | --- | --- | --- |
| **CWE-78** | OS command injection | `subprocess.*(..., shell=True)`, `os.system`, `os.popen` | Argument list + `shell=False` |
| **CWE-502** | Unsafe deserialization | `pickle.load`, `pickle.loads`, `_pickle`, `cPickle` | `json.loads` / `json.load` |
| **CWE-798** | Hardcoded credentials | Secret-like assignments plus `AKIA[0-9A-Z]{16}` regex sweep | `os.environ.get("<NAME>", "")` |

The scanner preserves source line numbers and the exact isolated snippet, so
the UI can show a focused before/after diff instead of a noisy whole-file diff.

### "VERIFIED" is a precise claim

A patch is marked **VERIFIED** only when all three checks pass:

1. `ast.parse(patched_code)` succeeds.
2. The deterministic scanner re-runs against the patched AST and no longer
   detects the target CWE.
3. The patch actually differs from the original snippet.

This is a proof of **syntactic validity and target-vector elimination**, not a
proof of full semantic equivalence or business-logic correctness. A human
reviewer remains responsible for the final change. That limitation is stated
here deliberately; overclaiming is how AI security tools lose trust.

---

## 3. Architecture

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                        DEVELOPER WORKSTATION (LOCAL)                       │
│                                                                            │
│   ┌──────────────────────────┐        POST /scan         ┌──────────────┐  │
│   │ Next.js 15 App Router UI │ ────────────────────────► │ FastAPI Core │  │
│   │ (#0A0A0A Linear/Sentry)  │                           │  (main.py)   │  │
│   └──────────────────────────┘                           └──────┬───────┘  │
│                ▲                                                │          │
│                │                                                ▼          │
│   ┌────────────┴─────────────┐                     ┌────────────────────┐  │
│   │ ReactDiffViewer + Status │                     │ 1. AST DETERMINISM │  │
│   │  • VERIFIED (#00C48C)    │                     │    (scanner.py)    │  │
│   │  • REJECTED (#FF3B3B)    │                     │ • CWE-78 (Shell)   │  │
│   └────────────▲─────────────┘                     │ • CWE-502 (Pickle) │  │
│                │                                   │ • CWE-798 (Secrets)│  │
│                │                                   └─────────┬──────────┘  │
│                │                                             │             │
│   ┌────────────┴─────────────┐                     ┌─────────▼──────────┐  │
│   │ 3. THE KILL SWITCH       │                     │ 2. LOCAL GEMMA 2   │  │
│   │    (verify.py)           │◄────────────────────┤    (llm.py)        │  │
│   │ • Gate 1: ast.parse()    │   Candidate Patch   │ • Ollama gemma2:9b │  │
│   │ • Gate 2: Re-run Scanner │                     │ • Fail-safe Mock   │  │
│   └──────────────────────────┘                     └────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```

### The three-stage pipeline

1. **Deterministic AST discovery** (`backend/scanner.py`) — Python's native
   `ast.NodeVisitor` walks the tree to pinpoint exact line numbers and nodes.
   A supplementary regex sweep catches raw AWS access keys even outside normal
   assignment nodes.
2. **Air-gapped Gemma 2 patch synthesis** (`backend/llm.py`) — each isolated
   snippet is sent to local `ollama.chat(model="gemma2:9b")` in strict JSON
   mode. If Ollama or the model is unavailable, a deterministic fallback
   produces a safe patch instead of crashing. The provider is labelled in the
   UI so the user always knows which path ran.
3. **The kill switch** (`backend/verify.py`) — before any patch is trusted,
   Python parses it, re-scans it, and rejects it if the target CWE survives.

### Why the fallback exists

Hackathon demos and cloud previews do not always have a 5.4 GB local model
available. The fallback keeps the audit pipeline useful and honest:

- It is explicitly labelled **FALLBACK PATCH**, never **GEMMA 2:9B**.
- It still goes through the same verifier; an invalid fallback is rejected.
- The health badge reports `Deterministic fallback` when Ollama is offline or
  the model is missing.
- On the local demo machine, `gemma2:9b` is installed and is used automatically.

---

## 4. Key features

- **Private by default:** in local mode, code is scanned in-process and never
  sent to a cloud API. Local mode requires no API keys, telemetry, CDN assets, or
  external fonts. The hosted preview is labelled **CLOUD PREVIEW** and sends
  snippets only to the CodeAsh Render backend, which uses the deterministic
  fallback.
- **Deterministic verification:** the model cannot override `verify.py`.
- **Focused diffs:** each finding renders only the vulnerable node and its
  candidate patch.
- **Provider transparency:** every card labels the patch source; the header
  status shows whether Gemma 2 is ready, the fallback is active, or the backend
  is offline.
- **Audit summary:** total findings, verified fixes, rejected fixes, and CWE
  class count appear after a scan.
- **Export:** copy or download the full audit as structured JSON.
- **Keyboard workflow:** `Ctrl/⌘ + Enter` runs the audit.
- **Responsive, dark-first UI:** designed for a 1440px workstation and a 390px
  phone without horizontal overflow.
- **Zero-crash cloud preview:** the Render backend can run without Ollama and
  still return verifier-approved fallback patches.

---

## 5. Tech stack

| Layer | Technology |
| --- | --- |
| UI | Next.js 15.5.28 (App Router), React 19.1.0, Tailwind CSS 4 |
| UI components | `react-diff-viewer-continued`, `lucide-react`, `geist` |
| API | FastAPI 0.115.6, Uvicorn 0.34.0, Pydantic 2.10.4 |
| Local model | Ollama 0.4.5 SDK, Gemma 2 9B (`gemma2:9b`) |
| Static analysis | Python 3.12 `ast`, `re`, `textwrap` |
| Verification | `unittest` (17 backend tests), production build, local + deployed browser runs |
| Deployment | Live on Vercel + Render; blueprint (`render.yaml`), `vercel.json` |

---

## 6. Repository layout

```text
codeash/
├── backend/
│   ├── main.py              # FastAPI routes, CORS, health, scan orchestration
│   ├── scanner.py           # Deterministic AST + regex vulnerability scanner
│   ├── llm.py               # Local Gemma 2 synthesis + deterministic fallback
│   ├── verify.py            # The kill switch: parse + re-scan
│   ├── test_api.py          # API contract, limits, fallback tests
│   ├── test_pipeline.py     # Scanner, fallback, verifier tests
│   ├── requirements.txt     # Runtime dependencies
│   ├── requirements-dev.txt # Test dependencies
│   └── .env.example         # Optional backend configuration
├── frontend/
│   ├── src/app/page.tsx     # Audit console, stats, findings, JSON export
│   ├── src/app/layout.tsx   # Metadata and self-hosted Geist fonts
│   ├── src/app/globals.css  # Dark cyber-physical design system
│   ├── vercel.json          # Vercel build configuration
│   └── .env.example         # NEXT_PUBLIC_API_URL
├── docs/screenshots/        # Local + live browser evidence
├── render.yaml              # Render backend blueprint
├── README.md
├── REQUIREMENTS.md          # Event compliance + software requirements
├── SUBMISSION.md            # Event-facing submission record
├── DEMO.md                  # Judge-facing demo guide
├── CODE_OF_CONDUCT.md       # Conduct expectations
├── CONTRIBUTING.md
├── LICENSE                  # MIT
└── .gitignore
```

---

## 7. Quickstart

### Prerequisites

- Python 3.12+
- Node.js 20+
- [Ollama](https://ollama.com/download) running at `http://localhost:11434`
- `gemma2:9b` pulled (optional; the deterministic fallback works without it)

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

On Linux/macOS, use `source venv/bin/activate`.

Verify the engine:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

Expected local result when Gemma 2 is available:

```json
{
  "status": "ok",
  "engine": "CodeAsh AST + Gemma 2 Verifier",
  "ollama_connected": true,
  "model_pulled": true,
  "model": "gemma2:9b"
}
```

If the model is not installed:

```powershell
ollama pull gemma2:9b
```

The scanner and verifier still work while the model downloads: requests use
the labelled deterministic fallback.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>, paste Python into the editor, and select
**RUN AUDIT**. The sample is preloaded with all three CWE classes.

The frontend reads `NEXT_PUBLIC_API_URL`; the default is
`http://localhost:8000`. Copy `.env.example` to `.env.local` if the backend is
elsewhere.

### Direct API check

```powershell
$body = @{ code = @'
import subprocess
subprocess.run("ls " + user_input, shell=True)
AWS_SECRET = "AKIAIOSFODNN7EXAMPLE"
'@ } | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri http://127.0.0.1:8000/scan `
  -ContentType "application/json" `
  -Body $body
```

---

## 8. Verification and evidence

### Automated backend suite

```powershell
cd backend
.\venv\Scripts\python.exe -m unittest discover -v
```

Result: **17 tests pass**. The suite covers:

- detection of all three CWE classes and exact line numbers
- clean code and syntax-error handling
- annotated secret assignments and `os.system`
- fallback patch generation and verifier acceptance
- identical, syntactically invalid, and still-vulnerable patches rejected
- API health, fallback scan, request validation, and size limits

### Frontend build

```powershell
cd frontend
npm run lint
npx tsc --noEmit
npm run build
```

The production build completes with the app route statically prerendered and
no type or lint errors.

### Local browser run (Gemma 2)

A production build (`next start`) was audited with headless Chrome against the
live local FastAPI backend and the installed `gemma2:9b` model. Evidence is
stored in [`docs/screenshots/`](docs/screenshots/):

- [`codeash-desktop.png`](docs/screenshots/codeash-desktop.png) — verified
  findings at 1440px
- [`codeash-mobile.png`](docs/screenshots/codeash-mobile.png) — responsive
  layout at 390px
- [`browser-run.json`](docs/screenshots/browser-run.json) — raw machine-readable
  result
- [`README.md`](docs/screenshots/README.md) — capture environment and provenance

Measured result:

| Check | Result |
| --- | --- |
| Audit wall-clock time | **42.6 s** (Gemma 2 on local hardware) |
| Findings | **3** (CWE-78, CWE-502, CWE-798) |
| Verified by `verify.py` | **3 / 3** |
| Rejected | **0** |
| Patch providers | **ollama, ollama, ollama** |
| Horizontal overflow | none at 320, 390, 768, 1024, 1440px |
| Console errors / page exceptions | **0 / 0** |
| External network requests | **0** |

### Deployed cloud preview run (fallback)

The production Vercel frontend was then audited end-to-end against the live
Render API using the same headless-Chrome procedure:

- [`codeash-live-desktop.png`](docs/screenshots/codeash-live-desktop.png) —
  three VERIFIED fallback patches at 1440px
- [`codeash-live-mobile.png`](docs/screenshots/codeash-live-mobile.png) —
  responsive layout at 390px
- [`live-browser-run.json`](docs/screenshots/live-browser-run.json) — raw
  deployment result

| Check | Result |
| --- | --- |
| App URL | <https://codeash.vercel.app> |
| API | <https://codeash-backend.onrender.com> |
| Hosting mode | Vercel production + Render free web service |
| Audit wall-clock time | **1.0 s** (network round trip, fallback engine) |
| Findings | **3** |
| Verified by `verify.py` | **3 / 3** |
| Rejected | **0** |
| Patch providers | **fallback, fallback, fallback** |
| Honesty labels | `CLOUD PREVIEW`, `RENDER PREVIEW`, `AST + FALLBACK` all present |
| Network hosts | only `codeash.vercel.app` + `codeash-backend.onrender.com` |
| Unexpected external requests | **0** |
| Console errors / page exceptions | **0 / 0** |
| Horizontal overflow | none at 320, 390, 768, 1024, 1440px |

---

## 9. Live deployment

Deployed and verified on **2026-10-26**.

| Component | Live URL | Configuration |
| --- | --- | --- |
| Frontend | <https://codeash.vercel.app> | Vercel production, static Next.js |
| Backend | <https://codeash-backend.onrender.com> | Render free web service, Oregon |
| Health | <https://codeash-backend.onrender.com/health> | `status: ok` |
| API docs | <https://codeash-backend.onrender.com/docs> | FastAPI OpenAPI |

Current Render health response:

```json
{
  "status": "ok",
  "engine": "CodeAsh AST + Gemma 2 Verifier",
  "ollama_connected": false,
  "model_pulled": false,
  "model": "fallback-deterministic-mock"
}
```

The live response also includes `revision`, the first seven characters of the
deployed Render commit (`RENDER_GIT_COMMIT`). Local runs report `local`.

Render does not provide an Ollama runtime, so the hosted deployment uses the
deterministic fallback. That is the intended zero-crash cloud posture, and the
UI discloses it with `CLOUD PREVIEW`, `RENDER PREVIEW`, and `AST + FALLBACK`
labels plus a banner. The Vercel project sets `NEXT_PUBLIC_API_URL` to
`https://codeash-backend.onrender.com` for Production, Preview, and
Development. Render's free instance can spin down after idle traffic; the first
request may take up to a minute while it wakes.

### Backend — Render

`render.yaml` defines a Python web service rooted at `backend/`:

- build: `pip install -r requirements.txt`
- start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Python: `3.11.9`

The service can also be created by pointing Render's **New → Blueprint** flow at
this repository. Its health check is `/health`.

### Frontend — Vercel

```powershell
cd frontend
npx vercel --prod
```

The checked-in `vercel.json` leaves the framework detection and build command
explicit. The production build was created after the Render URL was configured,
and the live HTML was verified to contain the Render API URL with no
`localhost:8000` fallback.

### CORS

The backend CORS policy allows localhost and `*.vercel.app` origins by default.
A preflight request from `https://codeash.vercel.app` returns `200` with the
matching `access-control-allow-origin`. For a custom frontend domain, set
`CODEASH_ALLOWED_ORIGINS` on Render as a comma-separated list.

---

## 10. Security model and limitations

### Controls

- **Fixed detector allowlist:** only the reviewed CWE classes are reported.
- **No code execution:** user code is parsed, never imported, evaluated, or
  executed. Patches are parsed, not run.
- **No code persistence:** the API does not write submitted source to disk and
  logs only CWE, line, provider, and verification status.
- **Bounded input:** 1 to 100,000 characters per request, validated by
  Pydantic.
- **Restrictive CORS:** no wildcard with credentials; localhost and Vercel
  origins are explicitly handled.
- **Untrusted LLM output:** every candidate patch is treated as hostile until
  `ast.parse` and a second scanner pass succeed.
- **No shell invocation** by the audit pipeline itself.

### Limitations

- CodeAsh is a demonstration of a verification architecture, not a replacement
  for a full SAST platform. It detects three high-severity CWE classes.
- Static AST matching can miss obfuscated or dynamically constructed sinks.
- The fallback patches are deterministic and intentionally conservative; they
  may need human adjustment for full program context.
- "Verified" proves syntax and target-vector removal, not complete semantic
  equivalence.
- The cloud preview cannot run Gemma 2 without a GPU host; it uses the clearly
  labelled fallback.

---

## 11. Responsible AI and attribution

- The application was created for the Hacktoberfest 2026 Hack Day
  (NIAT-ADYPU) submission.
- Initial implementation and documentation were produced with AI-assisted
  development using OpenCode, then reviewed and verified with the automated
  tests, production build, direct API checks, and local plus deployed browser
  runs.
- Gemma 2 is executed locally through Ollama in the primary demo. No cloud
  model provider or API key is required.
- The demo key `AKIAIOSFODNN7EXAMPLE` is a public AWS documentation example,
  not a live credential.
- The participant is responsible for reviewing the code, understanding the
  implementation, and keeping this disclosure accurate.

---

## 12. Hackathon submission

**Event:** Hacktoberfest 2026 Hack Day — NIAT-ADYPU

**Project:** CodeAsh

**Tagline:** Private, local security audit before you launch.

**Tracks:** Best Open-Source AI Project · Best Use of Gemma

**Live cloud preview:** <https://codeash.vercel.app>

The complete submission metadata, description, demo checklist, and deployment
status are maintained in [SUBMISSION.md](SUBMISSION.md).

---

## 13. Event compliance and governance

- [Requirements and compliance matrix](REQUIREMENTS.md) — event checks,
  software prerequisites, functional requirements, and repository structure.
- [Demo guide](DEMO.md) — live cloud-preview walkthrough and local Gemma 2 run.
- [Submission record](SUBMISSION.md) — description, disclosures, deployment, and
  final checklist.
- [Code of Conduct](CODE_OF_CONDUCT.md) — expected behavior and reporting.
- [Contributing](CONTRIBUTING.md) — development, detector, and AI-contribution
  rules.

Eligibility, official registration, team-size confirmation, the submission
deadline, and judging instructions remain the participant's responsibility.
The organizer's published instructions take precedence over this repository's
checklist.

---

## License

Copyright (c) 2026 Suraj Balasaheb Khanase. Distributed under the
[MIT License](LICENSE).
