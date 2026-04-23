# Project Structure (Quick Find)

This project keeps production code in `frontend/` and `backend/`.

## Where to edit frontend code

- App entry: `frontend/src/main.tsx`
- App shell: `frontend/src/App.tsx`
- Pages: `frontend/src/pages/`
- Reusable components: `frontend/src/components/`
- Hooks: `frontend/src/hooks/` and `frontend/src/_core/hooks/`
- Styles: `frontend/src/index.css`

## Where to edit backend code

- Server bootstrap: `backend/_core/index.ts`
- API router: `backend/routers.ts`
- Auth/session logic: `backend/_core/sdk.ts`, `backend/_core/oauth.ts`, `backend/_core/trpc.ts`
- Security helpers: `backend/security.ts`
- DB helpers: `backend/db.ts`

## Database

- Schema: `drizzle/schema.ts`
- SQL migrations: `drizzle/*.sql`
- Drizzle config: `drizzle.config.ts`

## Shared code

- Shared constants: `shared/const.ts`
- Shared types: `shared/types.ts`

## Quick commands

- Run app: `npm run dev`
- Run tests: `npm test`
- Type check: `npm run check`
