# CollabCode

CollabCode brings invite-only collaborative coding to VS Code with shared scratch documents, room chat, live cursors, and teacher-led session controls.

## Best Fit

- Classroom labs and live teaching sessions
- Mentoring, interview practice, and code walkthroughs
- Pair programming in temporary rooms
- Lightweight collaboration without leaving VS Code

## What You Get

- Hosted-first setup with no backend configuration required for the default experience
- Invite-only rooms with separate teacher and student tokens
- Shared scratch documents seeded from the active editor's file name, language, and contents
- Live cursor and selection sharing
- Room chat inside VS Code
- Teacher mode for read-only sessions and collaboration mode for shared editing
- Automatic reconnect behavior when the network drops temporarily

## Install

1. Install CollabCode from the VS Code Marketplace or from a VSIX package.
2. Optionally set your display name in `collabCode.userName`.
3. Run `CollabCode: Create Room` to start a session or `CollabCode: Join Room` to enter one.

## Create a Session

1. Open the file you want to use as the starting point for the room.
2. Run `CollabCode: Create Room`.
3. Enter a room ID and your display name.
4. CollabCode copies the student invite token to your clipboard and shows both invite tokens in a document.
5. Share only the student invite token with collaborators.

## Join a Session

1. Run `CollabCode: Join Room`.
2. Paste the teacher or student invite token.
3. Enter your display name.
4. CollabCode opens the shared session in a dedicated scratch document and connects you to the room sidebar.

## Commands

- `CollabCode: Create Room` - Create a new collaboration room from the current editor context.
- `CollabCode: Join Room` - Join an existing room with a teacher or student invite token.
- `CollabCode: Leave Room` - Disconnect from the active room.
- `CollabCode: Set Teacher Mode` - Make the room read-only for students.
- `CollabCode: Set Collaboration Mode` - Allow everyone in the room to edit.
- `CollabCode: Copy Room ID` - Copy the current room ID to the clipboard.
- `CollabCode: Copy Student Invite Token` - Copy the latest student invite token.
- `CollabCode: Send Chat Message` - Send a message to the room chat.
- `CollabCode: Open Getting Started` - Open the built-in onboarding panel.

## Settings

- `collabCode.serverUrl` - Override the default hosted backend URL for self-hosted deployments.
- `collabCode.userName` - Persist your preferred display name.
- `collabCode.lastRoomId` - Store the last room ID used as a convenience for future sessions.
- `collabCode.shareCursor` - Enable or disable cursor sharing.

## Hosted and Self-Hosted Use

CollabCode points to the hosted backend by default:

`https://code-collab-5qo3.onrender.com`

If you self-host the backend, update `collabCode.serverUrl` to your deployment URL. Keep the extension and backend on compatible major versions so the collaboration protocol matches.

Backend deployment guide:

- [Deploy the backend](https://github.com/Devanshu-Dhyanu/CODE_Bridge_extension_vscode/blob/main/docs/DEPLOY_BACKEND.md)

## Operational Notes

- The shared editor is a scratch document, not direct in-place editing of workspace files.
- Rooms, chat history, and shared document state are retained for seven days of inactivity by default.
- Invite tokens expire according to the configured backend TTL.
- Only a teacher can switch the room between Teacher and Collaboration mode.
- If the connection drops, the extension will try to reconnect automatically.

## Privacy and Support

- [Privacy policy](https://github.com/Devanshu-Dhyanu/CODE_Bridge_extension_vscode/blob/main/extension/PRIVACY.md)
- [Support](https://github.com/Devanshu-Dhyanu/CODE_Bridge_extension_vscode/blob/main/extension/SUPPORT.md)
- [Repository](https://github.com/Devanshu-Dhyanu/CODE_Bridge_extension_vscode)
