# CodeAsh Frontend

Next.js 15 App Router interface for the CodeAsh local security audit engine.

## Run locally

```powershell
npm install
npm run dev
```

The app expects the FastAPI backend at `http://localhost:8000`. Override it with
`NEXT_PUBLIC_API_URL` in `.env.local` if needed.

## Verify

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

## Design notes

- Dark cyber-physical theme with orange action accents and green/red proof
  states.
- Findings are rendered with `react-diff-viewer-continued`; worker mode is
  disabled for predictable bundling.
- The header badge reports whether Gemma 2 is ready, the deterministic fallback
  is active, or the backend is offline.
- The findings panel is intentionally honest: every card shows the patch
  provider and the deterministic verification result.
