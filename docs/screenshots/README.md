# Browser evidence — CodeAsh

This folder holds the evidence from the final local production run.

## Capture environment

| Item | Value |
| --- | --- |
| Date (UTC) | 2026-10-26T06:56:59Z |
| App URL | `http://127.0.0.1:3000` |
| Build | Next.js 15.5.28 production build, served with `next start` |
| Backend | FastAPI on `http://127.0.0.1:8000` |
| Model | Ollama 0.40.11, `gemma2:9b` |
| Browser | Headless Chrome 155.0.8059.85 via the DevTools Protocol |
| Viewport | 1440×1400 desktop; 390×844 mobile; overflow sweep at 320–1440px |

## Source sample

The preloaded `ast-target.py` sample, containing one finding of each supported
class:

- CWE-78 — `subprocess.run(..., shell=True)`
- CWE-502 — `pickle.loads(data)`
- CWE-798 — an AWS-documentation example key assigned to `AWS_SECRET`

## Result

| Metric | Value |
| --- | --- |
| Audit completed in | **42.6 seconds** |
| Findings | **3** |
| VERIFIED | **3** |
| REJECTED | **0** |
| Providers | **ollama, ollama, ollama** |
| Header engine state | Gemma 2 ready |
| Console errors | **0** |
| Page exceptions | **0** |
| Log errors | **0** |
| External network requests | **0** |
| Horizontal overflow | none at 320, 390, 768, 1024, 1440px |

## Files

| File | Description |
| --- | --- |
| `codeash-home.png` | Initial production UI at 1440px |
| `codeash-workspace.png` | Workspace before the audit |
| `codeash-desktop.png` | Completed audit with three VERIFIED patches |
| `codeash-mobile.png` | Completed audit at 390px |
| `browser-run.json` | Machine-readable run report |
| `browser-run.txt` | Rendered page text captured after the audit |

## Reproduce

```powershell
# Terminal 1 — backend
cd backend
.\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000

# Terminal 2 — production frontend
cd frontend
npm run build
npm start -- -H 127.0.0.1 -p 3000
```

Then run the browser audit from the repository root. The capture script lives
outside the repository (`%TEMP%\opencode\codeash-e2e.mjs`) and is intentionally
not committed; it drives headless Chrome through the DevTools Protocol, clicks
**RUN AUDIT**, reads the rendered verification badges, and records the raw
report.

## Honesty note

`VERIFIED` means Python successfully parsed the patched snippet and the
deterministic scanner no longer detects the target CWE. It does not prove full
semantic equivalence or business-logic correctness, and a human should review
every patch before merging it.
