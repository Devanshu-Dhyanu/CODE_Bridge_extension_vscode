# CollabCode

CollabCode is a small VS Code collaboration setup built as two parts:

- a VS Code extension in `extension/`
- a Socket.IO + Yjs server in `server/`

It lets multiple users join the same room, sync code in real time, share cursors, and use a simple room chat. There is also a teacher mode where only the teacher can edit and everyone else stays read-only.

This is intentionally smaller in scope than something like Live Share. The focus here is room-based collaboration with a simple local setup.

## What It Does

- create a room or join an existing one
- keep editor content in sync with Yjs
- show remote cursors and selections
- switch between collaboration mode and teacher mode
- show connected users in the sidebar
- send room chat messages from inside the extension
- reconnect and rejoin the room after short disconnects

## Repo Layout

```text
collab-code/
|- extension/   VS Code extension
|- server/      Express + Socket.IO backend
`- README.md
```

## How It Works

When someone joins a room, the server returns the current room state, user list, chat history, and the latest Yjs document state. The extension opens a dedicated collaborative document, applies that state locally, and then sends incremental updates back through Socket.IO as edits happen.

Teacher mode is handled on the server side. In that mode, only the teacher can push document changes. Students can still stay connected, see cursors, and use chat.

## Local Setup

### 1. Install dependencies

```bash
cd server
npm install

cd ../extension
npm install
```

### 2. Start the server

```bash
cd server
npm run dev
```

The default server URL is `http://localhost:3001`.

### 3. Build the extension

```bash
cd extension
npm run build
```

### 4. Run it in VS Code

1. Open the `extension` folder in VS Code.
2. Press `F5` to launch an Extension Development Host window.
3. In that window, run `CollabCode: Create Room`.
4. Open a second Extension Development Host window.
5. Run `CollabCode: Join Room` and use the same room ID.

## Commands

- `CollabCode: Create Room`
- `CollabCode: Join Room`
- `CollabCode: Leave Room`
- `CollabCode: Set Teacher Mode`
- `CollabCode: Set Collaboration Mode`
- `CollabCode: Copy Room ID`
- `CollabCode: Send Chat Message`

## Settings

- `collabCode.serverUrl`: backend URL
- `collabCode.userName`: saved display name
- `collabCode.lastRoomId`: last room ID used
- `collabCode.shareCursor`: enable or disable cursor sharing

## A Few Notes

- Room data is currently stored in memory, so restarting the server clears active rooms and chat history.
- The extension opens a dedicated collaborative buffer instead of directly editing files from the workspace.
- The server exposes `GET /health` and `GET /rooms` for quick checks while testing.
- If you deploy the backend, only the `server/` folder needs to run on the host. Then point `collabCode.serverUrl` at that deployed URL.

## Build Check

If you want to verify both parts manually:

```bash
cd server
npm run build

cd ../extension
npm run build
```
