# CodeAsh — Hackathon Submission

**Event:** Hacktoberfest 2026 Hack Day — NIAT-ADYPU

**Initiative:** NIAT × Hacktoberfest 2026

**Participant:** Suraj Balasaheb Khanase (solo)

**Project:** CodeAsh

**Tagline:** Private, local security audit before you launch.

**Repository:** <https://github.com/cyber-suraj/codeash>

**Tracks:** Best Open-Source AI Project · Best Use of Gemma

---

## Short description

CodeAsh turns a natural-language-free security review into a deterministic
proof. Paste Python; Python's AST engine finds CWE-78, CWE-502, and CWE-798;
local Gemma 2 (`gemma2:9b`) through Ollama proposes a patch; and a Python
"kill switch" rejects anything that fails `ast.parse()` or still trips the
detector on a second scan. No code is sent to a cloud model.

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
- `unittest` (16 backend tests)

## AI tools

- Ollama + Gemma 2 (`gemma2:9b`) as the local patch-synthesis engine
- OpenCode for AI-assisted implementation, reviewed and verified by the
  participant

## Demo evidence

- Screenshots: [`docs/screenshots/`](docs/screenshots/)
- Provenance: [`docs/screenshots/README.md`](docs/screenshots/README.md)
- Live browser run: [`browser-run.json`](docs/screenshots/browser-run.json) —
  production build, Gemma 2, **42.6 s**, **3/3 verified**, 0 rejected, 0
  console/page errors, 0 external requests
- Backend tests: `cd backend && .\venv\Scripts\python.exe -m unittest discover -v`
- Frontend checks: `cd frontend && npm run lint && npx tsc --noEmit && npm run build`

## Deployment

- Backend blueprint: [`render.yaml`](render.yaml) (Render; deterministic
  fallback when Ollama is unavailable)
- Frontend configuration: [`frontend/vercel.json`](frontend/vercel.json)
  (Vercel; set `NEXT_PUBLIC_API_URL` to the Render service URL)

Live production URLs will be added here after the deployment credentials and
services are available. The project is fully runnable locally without them.

## Submission checklist

- [x] Public source repository
- [x] MIT license and author attribution
- [x] Complete README with architecture, setup, and limitations
- [x] Local Gemma 2 integration verified end to end
- [x] Deterministic fallback verified without Ollama
- [x] 16 backend tests pass
- [x] TypeScript, ESLint, and production build pass
- [x] Live browser evidence captured
- [x] Responsible-AI and originality disclosure
- [ ] Final organizer registration and form submission
- [ ] Participant code review and final eligibility confirmation

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
