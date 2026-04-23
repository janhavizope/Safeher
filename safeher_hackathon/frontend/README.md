# Frontend Guide

`frontend/` contains the runtime frontend code.

## Main frontend files

- `frontend/src/main.tsx`: app bootstrap, providers, API client
- `frontend/src/App.tsx`: route and app shell composition
- `frontend/src/pages/`: screen-level pages
- `frontend/src/components/`: reusable UI components
- `frontend/src/lib/`: app utilities and API client wrappers
- `frontend/src/index.css`: global styles
- `frontend/public/`: static assets

## Core pages

- `frontend/src/pages/Home.tsx`
- `frontend/src/pages/Report.tsx`
- `frontend/src/pages/MapViewer.tsx`
- `frontend/src/pages/Admin.tsx`

## If you are adding a new frontend feature

1. Create/update page in `frontend/src/pages/`.
2. Build reusable parts in `frontend/src/components/`.
3. Wire API calls via `frontend/src/lib/trpc.ts`.
4. Register route in `frontend/src/App.tsx`.
