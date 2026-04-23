# SafeHer Hackathon

This repo is organized so code lives in `frontend/` and `backend/`.

## Start here

- Frontend code: `frontend/src`
- Backend code: `backend`
- Database schema/migrations: `drizzle` (schema) and `drizzle_pg` (PostgreSQL migrations)
- Shared types/constants: `shared`

## Most important files

- Frontend app entry: `frontend/src/main.tsx`
- Frontend routes/shell: `frontend/src/App.tsx`
- Backend server entry: `backend/_core/index.ts`
- Backend API routes: `backend/routers.ts`
- Backend auth/security middleware: `backend/_core/trpc.ts`
- Backend DB layer: `backend/db.ts`

## Run locally

1. Install packages:
   - `pnpm install`
2. Start app:
   - `pnpm dev`
3. Open:
   - `http://localhost:3000/`

## Mappls setup for Safe Route Finder

Set these environment variables before starting the app:

- `MAPPLS_REST_API_KEY` (required): used for Directions, Autosuggest, and Nearby API calls.
- `MAPPLS_MAP_SDK_KEY` (optional): key for loading the Mappls map SDK script. If omitted, `MAPPLS_REST_API_KEY` is used.
- `MAPPLS_CLIENT_ID` and `MAPPLS_CLIENT_SECRET` (optional): enables OAuth token flow for Atlas APIs when your account requires OAuth auth headers.

Mappls website checklist (`https://auth.mappls.com/console`):

1. Create/select your app in Mappls console.
2. Copy the REST API key and set `MAPPLS_REST_API_KEY`.
3. If provided separately, copy the Map SDK key and set `MAPPLS_MAP_SDK_KEY`.
4. In app/domain restrictions, allow `http://localhost:3000` for local dev.
5. Add your production frontend domain in the same allowed list before deployment.
6. Ensure Places/Autosuggest, Nearby, and Directions APIs are enabled for your key.
7. If your account requires OAuth for Atlas APIs, set both `MAPPLS_CLIENT_ID` and `MAPPLS_CLIENT_SECRET`.

After updating `.env`, restart dev server so new keys are loaded.

## PostgreSQL database setup

This project has been converted from MySQL to PostgreSQL.

1. In Aiven, create a new PostgreSQL service.
2. Copy the PostgreSQL connection string from the Aiven console.
3. Replace `DATABASE_URL` in `.env` with that PostgreSQL URL.
4. Restart the app and run the DB migration flow against the new database.

Note: your existing MySQL database data will not move automatically. If you need old rows, export and import them into the new PostgreSQL service.

## Navigation help

- Read `PROJECT_STRUCTURE.md` for a quick code map.
- Read `frontend/README.md` for UI editing paths.
- Read `backend/README.md` for API/server editing paths.
