# CollabCode

CollabCode is a room-based collaboration platform for VS Code. It combines a hosted-first extension with a self-hostable Socket.IO + Yjs backend so teams, mentors, and classrooms can start invite-only coding sessions with minimal setup.

## Why CollabCode

- Start collaborative sessions directly from VS Code.
- Seed a room from the file currently open in your editor.
- Control access with separate teacher and student invite tokens.
- Share live document updates, cursors, and room chat in real time.
- Keep room state durable with SQLite-backed persistence and restart recovery.
- Switch between teacher-led read-only sessions and full collaboration mode.

## Product Overview

- `extension/` contains the VS Code extension, sidebar UI, onboarding flow, and packaged VSIX builds.
- `server/` contains the Socket.IO backend, Yjs synchronization layer, rate limiting, and SQLite persistence.
- `docs/` contains deployment, publishing, and incident-response guides.

## Core Capabilities

- Hosted backend by default for extension users.
- Invite-only rooms with separate teacher and student tokens.
- Shared scratch document powered by Yjs.
- Live cursor and selection sharing.
- Room chat and teacher mode controls.
- Automatic reconnect support after temporary connection loss.
- Seven-day default retention for room state, chat history, and invite tokens.
- Health and admin endpoints for operations and debugging.

## Quick Start for Users

1. Install the extension from the VS Code Marketplace or from a VSIX in `extension/`.
2. Open the file you want to use as the starting point for the session, if any.
3. Run `CollabCode: Create Room`.
4. Share only the student invite token with collaborators.
5. Collaborators run `CollabCode: Join Room` and paste the invite token.

CollabCode opens the shared session in a dedicated scratch document. It does not edit workspace files in place.

## Local Development

### Backend

1. Copy `server/.env.example` to `server/.env` and set your secrets.
2. Install dependencies, build, test, and run the server:

```bash
cd server
npm install
npm run build
npm run test
npm run dev
```

### Extension

1. Install dependencies, build, and run the extension tests:

```bash
cd extension
npm install
npm run build
npm run test
```

2. Open the `extension/` folder in VS Code and press `F5` to launch an Extension Development Host.
3. If you are using a local backend, set `collabCode.serverUrl` to a URL such as `http://127.0.0.1:3001`.

## Self-Hosting the Backend

1. Deploy the service from the `server/` directory.
2. Configure at least `COLLABCODE_INVITE_SECRET`, `COLLABCODE_DB_PATH`, `COLLABCODE_ROOM_TTL_HOURS`, `COLLABCODE_MAX_USERS_PER_ROOM`, and `CORS_ORIGIN`.
3. Start the production server with `npm start`.
4. Point the extension to your deployment through `collabCode.serverUrl`.
5. Use `GET /health` for health checks and `GET /rooms` with `x-collabcode-admin-secret` for protected room inspection.

The extension and backend should stay on compatible major versions to avoid protocol mismatches.

## Repository Commands

```bash
cd server
npm install
npm run build
npm run test

cd ../extension
npm install
npm run build
npm run test
npm run package
```

## Documentation

- [Marketplace README](extension/README.md)
- [Backend deployment guide](docs/DEPLOY_BACKEND.md)
- [Extension publishing guide](docs/PUBLISH_EXTENSION.md)
- [Incident response guide](docs/INCIDENT_RESPONSE.md)

## Compatibility

- VS Code `^1.85.0`
- Extension and backend major versions should match

## License

MIT
