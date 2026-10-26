# Browser evidence — CodeAsh

This folder holds evidence from two end-to-end runs:

1. the final local production run with **Gemma 2** through Ollama; and
2. the deployed **Vercel + Render cloud preview** run using the deterministic
   fallback.

## Local capture environment

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

## Local result

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

## Deployed cloud preview environment

| Item | Value |
| --- | --- |
| Date (UTC) | 2026-10-26T07:37:36Z |
| App URL | `https://codeash.vercel.app` |
| API | `https://codeash-backend.onrender.com` |
| Deployment | Vercel production + Render free web service |
| Model | none; deterministic fallback |
| Browser | Headless Chrome 155.0.8059.85 via the DevTools Protocol |
| Viewport | 1440×1400 desktop; 390×844 mobile; overflow sweep at 320–1440px |

## Deployed cloud preview result

| Metric | Value |
| --- | --- |
| Audit completed in | **1.0 seconds** |
| Findings | **3** |
| VERIFIED | **3** |
| REJECTED | **0** |
| Providers | **fallback, fallback, fallback** |
| Header state | `AST + FALLBACK` / `DETERMINISTIC FALLBACK` |
| Cloud disclosure | `CLOUD PREVIEW`, `RENDER PREVIEW`, `sent to Render` all present |
| Request hosts | only `codeash.vercel.app` and `codeash-backend.onrender.com` |
| Unexpected external requests | **0** |
| Console errors | **0** |
| Page exceptions | **0** |
| Log errors | **0** |
| Horizontal overflow | none at 320, 390, 768, 1024, 1440px |

## Files

| File | Description |
| --- | --- |
| `codeash-home.png` | Local production UI at 1440px |
| `codeash-workspace.png` | Local workspace before the audit |
| `codeash-desktop.png` | Local completed audit with three VERIFIED Gemma 2 patches |
| `codeash-mobile.png` | Local completed audit at 390px |
| `browser-run.json` | Machine-readable local run report |
| `browser-run.txt` | Rendered local page text captured after the audit |
| `codeash-live-home.png` | Deployed cloud preview UI at 1440px |
| `codeash-live-workspace.png` | Deployed workspace before the audit |
| `codeash-live-desktop.png` | Deployed audit with three VERIFIED fallback patches |
| `codeash-live-mobile.png` | Deployed audit at 390px |
| `live-browser-run.json` | Machine-readable deployed run report |
| `live-browser-run.txt` | Rendered deployed page text captured after the audit |

## Reproduce the local run

```powershell
# Terminal 1 — backend
cd backend
.\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000

# Terminal 2 — production frontend
cd frontend
npm run build
npm start -- -H 127.0.0.1 -p 3000
```

Then run the browser audit from the repository root. The capture scripts live
outside the repository (`%TEMP%\opencode\codeash-e2e.mjs` and
`codeash-live-e2e.mjs`) and are intentionally not committed; they drive headless
Chrome through the DevTools Protocol, click **RUN AUDIT**, read the rendered
verification badges, and record the raw report.

## Honesty note

`VERIFIED` means Python successfully parsed the patched snippet and the
deterministic scanner no longer detects the target CWE. It does not prove full
semantic equivalence or business-logic correctness, and a human should review
every patch before merging it.

Local mode performs no network egress beyond the loopback backend. The hosted
cloud preview is not zero-egress: it sends snippets to the CodeAsh Render
backend, which uses deterministic fallback patches because Ollama is not
available there.
