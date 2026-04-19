# Deploying the Backend

## Recommended runtime

- Render Starter web service
- Persistent disk enabled
- Single instance only for v1

## Root directory

- `server`

## Build and start

- Build: `npm install && npm run build`
- Start: `npm start`

## Required environment variables

- `COLLABCODE_INVITE_SECRET`
- `COLLABCODE_DB_PATH`
- `COLLABCODE_ROOM_TTL_HOURS=168`
- `COLLABCODE_MAX_USERS_PER_ROOM`
- `CORS_ORIGIN`

## Optional operational variables

- `COLLABCODE_ADMIN_SECRET`
- create/join/chat/cursor rate-limit variables from `server/.env.example`

## Health and admin checks

- Health: `GET /health`
- Protected rooms list: `GET /rooms` with header `x-collabcode-admin-secret`
