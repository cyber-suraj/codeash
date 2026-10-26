# CodeAsh — Demo Guide

**Live cloud preview:** <https://codeash.vercel.app>  
**API health:** <https://codeash-backend.onrender.com/health>

CodeAsh has two demo modes. Use the live preview for a fast walkthrough; use
local mode when you want to show Gemma 2 running through Ollama with no cloud
egress.

---

## Mode A — Live cloud preview (about 1 minute)

The hosted deployment is intentionally labelled **CLOUD PREVIEW**. Render does
not provide an Ollama runtime, so the backend uses verifier-approved
deterministic fallback patches.

1. Open <https://codeash.vercel.app>.
2. Point out the disclosure strip:
   - `CLOUD PREVIEW`
   - `RENDER PREVIEW`
   - `AST + FALLBACK`
   - “untrusted input · sent to Render”
3. The preloaded `ast-target.py` sample contains three findings:
   - CWE-78 — `subprocess.run(..., shell=True)`
   - CWE-502 — `pickle.loads(data)`
   - CWE-798 — AWS documentation example key assigned to `AWS_SECRET`
4. Select **RUN AUDIT**.
5. In about a second, show:
   - **3 findings**
   - **3 VERIFIED**
   - **0 REJECTED**
   - `FALLBACK PATCH` on every card
6. Open one card and show the deterministic re-scan message:
   > VERIFIED — Python re-scanned the patched AST and proved this CWE is gone.
   > The kill switch passed.
7. Optional: use the copy/download JSON action to show the audit report.
8. State the limitation: **VERIFIED** proves syntax validity and target-CWE
   removal, not full semantic equivalence.

If Render has spun down, the first request can take up to a minute. Keep the
page open for a moment before starting the narration.

---

## Mode B — Local Gemma 2 demo (about 1 minute after setup)

### Prerequisites

- Python 3.12+
- Node.js 20+
- Ollama running at `http://localhost:11434`
- `gemma2:9b` pulled

```powershell
ollama pull gemma2:9b
```

### Start the backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8000
```

### Start the frontend

In a second terminal:

```powershell
cd frontend
npm install
npm run build
npm start -- -H 127.0.0.1 -p 3000
```

Open <http://127.0.0.1:3000>. Confirm the header says `LOCAL-FIRST` and the
engine pill says `Gemma 2 ready`.

Select **RUN AUDIT**. On the verified local run this took **42.6 seconds**:

| Result | Value |
| --- | --- |
| Findings | 3 |
| VERIFIED | 3 |
| REJECTED | 0 |
| Providers | `GEMMA 2:9B` × 3 |

Show that the local mode contains no `CLOUD PREVIEW` banner and that the footer
reports the local engine.

If Ollama or the model is unavailable, the same UI falls back to the labelled
deterministic patches instead of crashing.

---

## What to emphasize

- **The model cannot mark its own homework.** `verify.py` parses every candidate
  patch and re-runs the deterministic scanner. A patch with the target CWE still
  present is rejected.
- **Provider transparency.** The UI distinguishes `GEMMA 2:9B` from
  `FALLBACK PATCH`; the hosted preview never pretends to run Gemma.
- **No external AI API.** Local mode uses Ollama only; the hosted preview uses
  the project's own FastAPI service on Render.
- **Accountable limitation.** The sample AWS key is a public documentation
  example, not a live credential. A human must review every patch.

---

## Evidence

| Artifact | Location |
| --- | --- |
| Local Gemma screenshots | [`docs/screenshots/codeash-desktop.png`](docs/screenshots/codeash-desktop.png), [`codeash-mobile.png`](docs/screenshots/codeash-mobile.png) |
| Local run report | [`docs/screenshots/browser-run.json`](docs/screenshots/browser-run.json) |
| Deployed screenshots | [`docs/screenshots/codeash-live-desktop.png`](docs/screenshots/codeash-live-desktop.png), [`codeash-live-mobile.png`](docs/screenshots/codeash-live-mobile.png) |
| Deployed run report | [`docs/screenshots/live-browser-run.json`](docs/screenshots/live-browser-run.json) |
| Provenance and metrics | [`docs/screenshots/README.md`](docs/screenshots/README.md) |
| Submission record | [`SUBMISSION.md`](SUBMISSION.md) |

---

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Header says `Backend offline` | Check the backend is running and `NEXT_PUBLIC_API_URL` is correct |
| Header says `Deterministic fallback` | Ollama is not running or `gemma2:9b` is not pulled; this is expected on Render |
| First live request is slow | Render's free instance is waking; wait up to a minute |
| `RUN AUDIT` disabled while checking | Wait for the health check to finish |
| Local model takes 20–90 s | First Gemma load is slow; subsequent runs reuse the model |
