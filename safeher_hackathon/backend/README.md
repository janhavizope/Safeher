# Backend Guide

`backend/` contains the runtime backend code.

## Main backend files

- `backend/_core/index.ts`: Express + tRPC server startup
- `backend/routers.ts`: API endpoints grouped by feature
- `backend/_core/trpc.ts`: auth middleware and protected/admin procedures
- `backend/_core/sdk.ts`: OAuth/session helpers
- `backend/_core/oauth.ts`: OAuth callback endpoint
- `backend/db.ts`: database query functions
- `backend/security.ts`: request/device/IP security helpers
- `backend/storage.ts`: upload storage adapter

## If you are adding a new backend feature

1. Add endpoint in `backend/routers.ts`.
2. Add DB function in `backend/db.ts` (if needed).
3. Add validation/security logic in `backend/security.ts` (if needed).
4. Add tests in `backend/*.test.ts`.
