# CollabCode

Real-time collaborative coding for VS Code with:

- room creation and joining
- teacher and student roles
- live document sync with Yjs
- shared cursors
- sidebar users list
- sidebar room info and chat
- reconnect-aware extension behavior

## Folder Structure

```text
collab-code/
|-- server/
|   |-- package.json
|   |-- package-lock.json
|   |-- tsconfig.json
|   `-- src/
|       |-- index.ts
|       |-- roomManager.ts
|       `-- types.ts
|-- extension/
|   |-- package.json
|   |-- package-lock.json
|   |-- tsconfig.json
|   |-- resources/
|   |   `-- collabcode.svg
|   `-- src/
|       |-- collabManager.ts
|       |-- cursorManager.ts
|       |-- extension.ts
|       |-- sidebarViewProvider.ts
|       |-- statusBar.ts
|       |-- types.ts
|       |-- usersTreeProvider.ts
|       `-- websocketClient.ts
`-- README.md
```

## Architecture

- `server/src/index.ts`: Express and Socket.IO entry point, validation, room events, chat, cursor updates, and mode changes.
- `server/src/roomManager.ts`: in-memory room lifecycle, Yjs state, users, cursors, and chat history.
- `server/src/types.ts`: server-side room and event payload interfaces.
- `extension/src/extension.ts`: VS Code activation, command wiring, tree view, and webview registration.
- `extension/src/collabManager.ts`: session state, reconnect logic, collaborative document management, Yjs syncing, and chat handling.
- `extension/src/websocketClient.ts`: typed Socket.IO client wrapper.
- `extension/src/sidebarViewProvider.ts`: room status and chat UI in the VS Code sidebar.
- `extension/src/usersTreeProvider.ts`: connected users tree view.
- `extension/src/cursorManager.ts`: remote cursor and selection decorations.
- `extension/src/statusBar.ts`: connection and room status in the status bar.

## Features

- Full room snapshot on join.
- Incremental document updates after join with Yjs CRDT.
- Teacher mode where only the teacher can edit.
- Collaboration mode where everyone can edit.
- Cursor sharing and remote selections.
- Room chat inside the extension sidebar.
- Connected users list in the activity bar.
- Auto-rejoin after temporary disconnects.
- Health and room list HTTP endpoints on the server.

## Publish Prep

Before public release, replace the placeholder GitHub links in:

- `extension/package.json`
- `server/package.json`

Current placeholder:

```text
https://github.com/your-username/collab-code.git
```

## Setup

### 1. Install dependencies

```bash
cd server
npm install

cd ../extension
npm install
```

### 2. Start the backend

```bash
cd server
npm run dev
```

The server listens on `http://localhost:3001` by default.

### 3. Build the extension

```bash
cd extension
npm run build
```

### 4. Run the extension locally

1. Open the `extension` folder in VS Code.
2. Press `F5`.
3. A new Extension Development Host window will open.
4. In one window, run `CollabCode: Create Room`.
5. In another window, run `CollabCode: Join Room` with the same room ID.

## How It Works Locally

1. The creator joins with a room ID, role, name, and current editor content.
2. The server creates the room, seeds the Yjs document, and returns:
   - room metadata
   - current users
   - chat history
   - encoded Yjs state
3. The extension opens a dedicated collaborative document and applies the shared Yjs state.
4. Local editor changes are converted into Yjs updates.
5. The server applies each update and broadcasts it to peers.
6. Sidebar chat and users update in real time through Socket.IO events.

## Commands

- `CollabCode: Create Room`
- `CollabCode: Join Room`
- `CollabCode: Leave Room`
- `CollabCode: Set Teacher Mode`
- `CollabCode: Set Collaboration Mode`
- `CollabCode: Copy Room ID`
- `CollabCode: Send Chat Message`

## Extension Settings

- `collabCode.serverUrl`: WebSocket server URL.
- `collabCode.userName`: default display name.
- `collabCode.lastRoomId`: remembers the last room ID.
- `collabCode.shareCursor`: toggles cursor broadcasting.

## Local Verification

Both packages build successfully:

```bash
cd server && npm run build
cd extension && npm run build
```

## Deploy The Server

### Option A: Render exact steps

1. Push this repo to GitHub.
2. Open Render.
3. Click `New +`.
4. Click `Web Service`.
5. Connect your GitHub repo.
6. Set `Root Directory` to `server`.
7. Set `Build Command` to:

```bash
npm install && npm run build
```

8. Set `Start Command` to:

```bash
npm start
```

9. Add environment variable:

```bash
CORS_ORIGIN=*
```

10. Click `Create Web Service`.
11. After deploy, copy the Render service URL.
12. In VS Code extension settings, set:

```text
collabCode.serverUrl=https://your-render-service.onrender.com
```

### Option B: Railway exact steps

1. Push this repo to GitHub.
2. Open Railway.
3. Click `New Project`.
4. Choose `Deploy from GitHub repo`.
5. Select this repo.
6. Set the service root to `server`.
7. Add environment variable:

```bash
CORS_ORIGIN=*
```

8. Railway detects Node automatically.
9. Set start command to:

```bash
npm start
```

10. Set build command to:

```bash
npm run build
```

11. Deploy and copy the generated public URL.
12. Update the extension setting:

```text
collabCode.serverUrl=https://your-railway-domain.up.railway.app
```

### Production notes

- The app already reads `PORT` from the deployment environment.
- Replace `CORS_ORIGIN=*` with your trusted frontend or extension origin policy when you harden production.
- For a real public launch, add auth, rate limiting, and persistent storage.

## Publish The Extension

### Exact prerequisites

1. Create a Visual Studio Marketplace publisher.
2. Make sure the `publisher` field in `extension/package.json` matches that publisher.
3. Create a Personal Access Token for the Marketplace.
4. Open PowerShell in the `extension` folder.

### Login once

```powershell
npx @vscode/vsce login YOUR_PUBLISHER_NAME
```

When prompted, paste your Marketplace PAT.

### Build and package

```powershell
cd extension
npm install
npm run build
npm run package
```

This creates:

```text
extension/collab-code-1.0.0.vsix
```

### Test the VSIX locally

```powershell
code --install-extension collab-code-1.0.0.vsix
```

### Publish to Marketplace

```powershell
npm run publish:marketplace
```

### Publish with an explicit token in CI or a fresh shell

```powershell
$env:VSCE_PAT="YOUR_MARKETPLACE_PAT"
npx @vscode/vsce publish --no-yarn -p $env:VSCE_PAT
```

Before publishing publicly, update:

- `publisher` in `extension/package.json`
- repository URLs in `extension/package.json` and `server/package.json`
- extension version
- marketplace description, banner, and screenshots

## Notes

- Rooms are in-memory right now, which keeps the code simple and fast for local use.
- The collaborative editor intentionally opens a dedicated buffer so the extension does not overwrite arbitrary workspace files when a room syncs.
- The server owns room authority, permissions, chat history, and cursor fan-out.
- The extension packages cleanly as a `.vsix`; the remaining packaging suggestion is optional bundling to reduce file count further.
