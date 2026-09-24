# frontend-next — Next.js client for backend-python

Login and chat screens only. Talks only to `backend-python` (auth + chat); no Node backend.

## Run
```bash
cd frontend-next
npm install
npm run dev            # http://localhost:3000
# backend-python must be running on :5002 (override: API_TARGET=http://localhost:5012 npm run dev)
```

`next.config.ts` rewrites `/api/*` → `${API_TARGET}/api/*`, so the browser sees a single origin (no CORS).
SSE streaming works through the rewrite.

## Files
| File | Role |
|---|---|
| `src/lib/api.ts` | Types, `fetch` wrapper (Bearer token from localStorage, throws `ApiError` with backend `message`), `streamMessage` SSE reader |
| `src/lib/auth.tsx` | `AuthProvider` / `useAuth`: validates the stored token via `/auth/me` on load; login, register, logout |
| `src/lib/roles.ts` | Role list (ids/names match `backend-python/app/roles.json`) + per-role colour |
| `src/app/layout.tsx` | Fonts (Bricolage Grotesque display, Instrument Sans body), `AuthProvider` |
| `src/app/page.tsx` | Redirects to `/chat` |
| `src/app/login/page.tsx` | Log in / create account form (toggle) |
| `src/app/chat/page.tsx` | Guarded chat: left rail (start with a role, recent conversations, delete, log out) + conversation pane with streaming replies; pane is tinted by the active role's colour |

## Flow
1. `/chat` with no valid token → `/login`.
2. Log in / register → token saved to `localStorage` (`va_token`) → `/chat`.
3. Pick a role → `POST /api/chat/conversations` → send → `POST /api/chat/message` streamed into the last bubble → list refreshed.
