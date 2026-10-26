# CodeAsh — Requirements, Compliance, and Repository Structure

This document is the project-level requirements record for **CodeAsh**. It maps
the known event guidance for **Hacktoberfest 2026 Hack Day — NIAT-ADYPU** to the
repository, records the software prerequisites, and defines the submission
layout.

It is not an official organizer document. If the organizers publish different
rules, deadlines, team limits, form fields, or judging instructions, their
instructions take precedence.

---

## 1. Event requirements

The event guidance supplied to the participant requires eligibility,
registration, a public repository, original-work disclosure, responsible AI use,
and a completed submission before the announced deadline. The matrix below
turns that guidance into verifiable project checks.

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Participant eligibility under organizer rules | **Participant action** | Confirm with organizers |
| 2 | Official event registration completed | **Participant action** | Organizer registration system |
| 3 | Team size within the announced limit | **Assumed compliant — confirm** | Solo: Suraj Balasaheb Khanase |
| 4 | Public source-code repository | **Satisfied** | <https://github.com/cyber-suraj/codeash> |
| 5 | Open-source license and attribution | **Satisfied** | [`LICENSE`](LICENSE), MIT |
| 6 | Working prototype | **Satisfied** | Local app + <https://codeash.vercel.app> |
| 7 | README with setup, architecture, and limitations | **Satisfied** | [`README.md`](README.md) |
| 8 | Demo instructions and captured evidence | **Satisfied** | [`DEMO.md`](DEMO.md), [`docs/screenshots/`](docs/screenshots/) |
| 9 | Original-work and pre-existing-work disclosure | **Satisfied** | [`SUBMISSION.md`](SUBMISSION.md#originality-and-pre-existing-work) |
| 10 | Responsible-AI disclosure | **Satisfied** | README §11, [`SUBMISSION.md`](SUBMISSION.md#responsible-ai-statement) |
| 11 | Security and privacy review | **Satisfied** | [`SUBMISSION.md`](SUBMISSION.md#security-and-privacy) |
| 12 | Code of Conduct followed | **Satisfied** | [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) |
| 13 | Third-party licenses respected | **Satisfied** | No vendored source; pip/npm dependencies retain upstream licenses |
| 14 | Submission completed before the deadline | **Participant action** | Organizer deadline and form |
| 15 | Judging and organizer instructions followed | **Participant action** | Organizer instructions |

> Items 1, 2, 3, 14, and 15 cannot be completed by a repository change. They
> remain the participant's responsibility and are repeated in the final
> checklist of [`SUBMISSION.md`](SUBMISSION.md).

---

## 2. Software requirements

### Local runtime

| Component | Requirement |
| --- | --- |
| Python | 3.12+ tested locally; Render deployment pins 3.11.9 |
| Node.js | 20+ |
| npm | Included with Node.js 20+ |
| Ollama | Optional; required for local Gemma 2 synthesis |
| Gemma model | `gemma2:9b` (approximately 5.4 GB) |
| Browser | Current Chromium, Firefox, or Safari with ES2020 support |

### Backend dependencies

[`backend/requirements.txt`](backend/requirements.txt):

```text
fastapi==0.115.6
uvicorn[standard]==0.34.0
pydantic==2.10.4
ollama==0.4.5
```

[`backend/requirements-dev.txt`](backend/requirements-dev.txt) adds:

```text
-r requirements.txt
httpx==0.27.2
```

### Frontend dependencies

Pinned in [`frontend/package-lock.json`](frontend/package-lock.json), with the
main runtime stack declared in [`frontend/package.json`](frontend/package.json):

- Next.js 15.5.28
- React 19.1.0
- Tailwind CSS 4
- `react-diff-viewer-continued`
- `lucide-react`
- `geist`

### Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Production | `http://localhost:8000` | Frontend → backend base URL |
| `CODEASH_OLLAMA_MODEL` | No | `gemma2:9b` | Ollama model name |
| `CODEASH_ALLOWED_ORIGINS` | No | localhost + `*.vercel.app` | Extra comma-separated CORS origins |

No external AI API key, paid model subscription, database, or cloud storage is
required.

---

## 3. Functional requirements

| ID | Requirement | Implementation |
| --- | --- | --- |
| FR-1 | Detect CWE-78 OS command injection | `backend/scanner.py` AST + regex checks |
| FR-2 | Detect CWE-502 unsafe deserialization | `backend/scanner.py` AST checks |
| FR-3 | Detect CWE-798 hardcoded credentials | `backend/scanner.py` assignment + secret-pattern checks |
| FR-4 | Preserve source line numbers and isolated snippets | Scanner findings include `line` and `original_code` |
| FR-5 | Propose patches with local Gemma 2 | `backend/llm.py` via Ollama `gemma2:9b` |
| FR-6 | Never crash when Ollama is unavailable | Deterministic fallback patches |
| FR-7 | Reject syntactically invalid patches | `ast.parse()` gate in `backend/verify.py` |
| FR-8 | Reject patches that leave the target CWE | Full deterministic re-scan in `backend/verify.py` |
| FR-9 | Label every patch provider | `GEMMA 2:9B` or `FALLBACK PATCH` in the UI |
| FR-10 | Disclose hosted-preview data flow | `CLOUD PREVIEW` / `RENDER PREVIEW` labels |
| FR-11 | Provide responsive audit UI | Next.js app, checked at 320–1440px |
| FR-12 | Export audit results | JSON copy/download from the UI |
| FR-13 | Bound request size and reject invalid input | 1–100,000 characters, Pydantic validation |
| FR-14 | Restrict CORS | Explicit localhost and Vercel allowlist |
| FR-15 | Keep the pipeline deterministic and testable | 17 backend tests, production build checks |

`VERIFIED` is deliberately scoped to **syntax validity + target-CWE
elimination**. It is not proof of semantic equivalence or business-logic
correctness. A human must review every patch.

---

## 4. Repository structure

```text
codeash/
├── backend/
│   ├── main.py                  # FastAPI routes, CORS, health, scan orchestration
│   ├── scanner.py               # Deterministic AST + regex scanner
│   ├── llm.py                   # Gemma 2 synthesis + deterministic fallback
│   ├── verify.py                # ast.parse + re-scan kill switch
│   ├── test_api.py              # API contract and validation tests
│   ├── test_pipeline.py         # Scanner, fallback, verifier tests
│   ├── requirements.txt         # Runtime dependencies
│   ├── requirements-dev.txt     # Test dependencies
│   └── .env.example             # Optional backend configuration template
├── frontend/
│   ├── src/app/page.tsx         # Audit console, findings, stats, JSON export
│   ├── src/app/layout.tsx       # Metadata and self-hosted Geist fonts
│   ├── src/app/globals.css      # Dark cyber-physical design system
│   ├── src/app/icon.svg         # Flame favicon
│   ├── vercel.json              # Vercel build configuration
│   ├── next.config.ts           # Security headers and CSP
│   └── .env.example             # NEXT_PUBLIC_API_URL template
├── docs/
│   └── screenshots/             # Local + deployed browser evidence
├── CODE_OF_CONDUCT.md           # Project conduct expectations
├── CONTRIBUTING.md              # Contribution and test workflow
├── DEMO.md                      # Judge-facing demo script
├── LICENSE                      # MIT license
├── README.md                    # Product, architecture, setup, limitations
├── REQUIREMENTS.md              # This document
├── SUBMISSION.md                # Event-facing submission record
├── render.yaml                  # Render backend blueprint
├── .gitattributes
└── .gitignore
```

### Root-file responsibilities

| File | Purpose |
| --- | --- |
| `README.md` | Public entry point: problem, architecture, quickstart, verification |
| `REQUIREMENTS.md` | Event compliance matrix and software/functional requirements |
| `SUBMISSION.md` | Submission description, disclosure, deployment, checklist |
| `DEMO.md` | Short live demo and full local Gemma demo |
| `CODE_OF_CONDUCT.md` | Conduct expectations and reporting |
| `CONTRIBUTING.md` | Development, detector, AI-contribution, and security-report rules |
| `LICENSE` | MIT license and copyright |
| `render.yaml` | Infrastructure definition for the backend |
| `frontend/vercel.json` | Explicit Vercel framework/build configuration |
| `docs/screenshots/` | Captured local and deployed browser evidence |

---

## 5. Verification commands

```powershell
# Backend tests
cd backend
.\venv\Scripts\python.exe -m unittest discover -v

# Frontend checks
cd ..\frontend
npm run typecheck
npm run lint
npm run build
```

Expected result:

- 17 backend tests pass.
- TypeScript, ESLint, and the production build pass.
- The API health endpoint returns `status: ok`.
- The sample audit returns 3 findings, 3 verified patches, and 0 rejected.

Live verification:

- Frontend: <https://codeash.vercel.app>
- Backend health: <https://codeash-backend.onrender.com/health>
- API docs: <https://codeash-backend.onrender.com/docs>

---

## 6. Final organizer actions

The repository cannot complete these items:

- [ ] Confirm eligibility under the organizer's rules.
- [ ] Complete official registration with accurate details.
- [ ] Confirm the solo submission complies with the announced team-size limit.
- [ ] Submit the public repository and live demo links through the official form.
- [ ] Complete the submission before the announced deadline.
- [ ] Follow the organizer's judging and demo instructions.
- [ ] Keep the participant's final review and AI disclosure accurate.

The project-level checklist is maintained in
[`SUBMISSION.md`](SUBMISSION.md#submission-checklist).
