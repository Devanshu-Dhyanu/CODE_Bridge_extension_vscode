# CollabCode

CollabCode is a two-part collaboration project:

- `extension/`: a VS Code extension for invite-only collaborative rooms
- `server/`: a durable Socket.IO + Yjs backend with SQLite persistence

## Current product shape

- Hosted backend by default for extension users
- Invite-token access for teacher and student roles
- Shared scratch document, room chat, and cursor sharing
- Teacher mode for read-only classroom sessions
- Seven-day room retention with automatic cleanup

## Quick start for users

1. Install the extension from the VS Code Marketplace or a VSIX build.
2. Run `CollabCode: Create Room`.
3. Share the copied student invite token.
4. Collaborators run `CollabCode: Join Room` with that token.

## Repo commands

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

- Backend deploy guide: [docs/DEPLOY_BACKEND.md](docs/DEPLOY_BACKEND.md)
- Publish guide: [docs/PUBLISH_EXTENSION.md](docs/PUBLISH_EXTENSION.md)
- Incident/debug guide: [docs/INCIDENT_RESPONSE.md](docs/INCIDENT_RESPONSE.md)
- Marketplace README: [extension/README.md](extension/README.md)
